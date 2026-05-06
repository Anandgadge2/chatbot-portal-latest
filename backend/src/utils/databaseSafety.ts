import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';
import mongoose, { Connection, Query } from 'mongoose';
import { logger } from '../config/logger';

type SupportedWriteOperation =
  | 'deleteMany'
  | 'deleteOne'
  | 'findOneAndDelete'
  | 'findOneAndReplace'
  | 'findOneAndUpdate'
  | 'replaceOne'
  | 'updateMany'
  | 'updateOne';

type RiskyOperationContext = {
  collectionName: string;
  operation: SupportedWriteOperation | 'dropDatabase' | 'dropCollection' | 'bulkWrite';
  query: Record<string, unknown>;
  update?: unknown;
};

type DatabaseSafetyRequestStore = {
  requestId: string;
  req: Request;
};

const WRITE_OPERATIONS = new Set<SupportedWriteOperation>([
  'deleteMany',
  'deleteOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne'
]);

const requestContext = new AsyncLocalStorage<DatabaseSafetyRequestStore>();

let queryGuardInstalled = false;
let nativeGuardsInstalled = false;

export class DatabaseSafetyError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DatabaseSafetyError';
    this.statusCode = statusCode;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const isEmptyQuery = (value: unknown): boolean => {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.keys(value).length === 0;
};

const isBulkOperation = (operation: RiskyOperationContext['operation']): boolean => {
  return operation === 'deleteMany' || operation === 'updateMany' || operation === 'bulkWrite';
};

const isProduction = (): boolean => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const dangerousDbOperationsAllowed = (): boolean => process.env.ALLOW_DANGEROUS_DB_OPERATIONS === 'true';

const getRequestSummary = () => {
  const store = requestContext.getStore();
  if (!store) {
    return undefined;
  }

  const user = store.req.user;

  return {
    requestId: store.requestId,
    method: store.req.method,
    path: store.req.originalUrl || store.req.url,
    ip: store.req.ip,
    userAgent: store.req.get('user-agent'),
    userId: user?._id?.toString(),
    companyId: user?.companyId?.toString(),
    isSuperAdmin: user?.isSuperAdmin
  };
};

export const databaseSafetyContextMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const incomingRequestId = req.get('x-request-id') || req.get('x-vercel-id');
  const requestId = incomingRequestId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  requestContext.run({ requestId, req }, next);
};

const logWriteAttempt = ({ collectionName, operation, query, update }: RiskyOperationContext): void => {
  logger.warn(
    JSON.stringify({
      type: 'db-write-attempt',
      collectionName,
      operation,
      query,
      update,
      request: getRequestSummary(),
      timestamp: new Date().toISOString()
    })
  );
};

const assertWriteIsSafe = ({ collectionName, operation, query }: RiskyOperationContext): void => {
  if (operation === 'dropDatabase') {
    if (!dangerousDbOperationsAllowed()) {
      throw new DatabaseSafetyError('dropDatabase() is disabled. Set ALLOW_DANGEROUS_DB_OPERATIONS=true only for an intentional maintenance task.', 403);
    }

    return;
  }

  if (operation === 'dropCollection') {
    if (!dangerousDbOperationsAllowed()) {
      throw new DatabaseSafetyError(`collection.drop() is disabled for ${collectionName}. Set ALLOW_DANGEROUS_DB_OPERATIONS=true only for an intentional maintenance task.`, 403);
    }

    return;
  }

  if (operation === 'deleteMany' && isEmptyQuery(query)) {
    if (collectionName === 'users') {
      throw new DatabaseSafetyError('Refusing to delete all users from the users collection.', 403);
    }

    throw new DatabaseSafetyError('Refusing to run deleteMany with an empty query.', 403);
  }

  if (isProduction() && operation === 'deleteMany' && isEmptyQuery(query)) {
    throw new DatabaseSafetyError('deleteMany({}) is blocked in production.', 403);
  }
};

const guardRiskyWriteOperation = async (context: RiskyOperationContext): Promise<void> => {
  // 🔍 ENHANCED AUDIT: Log all write attempts to help identify who is clearing the database
  logWriteAttempt(context);

  assertWriteIsSafe(context);

  if (isBulkOperation(context.operation)) {
    logger.info(`🚨 BULK OPERATION DETECTED: [${context.operation}] on collection [${context.collectionName}] with query: ${JSON.stringify(context.query)}`);
    // await runMongoBackup(); // Disabled to improve performance
  }
};

const getNativeOperationQuery = (args: unknown[]): Record<string, unknown> => {
  const query = args[0];
  return isPlainObject(query) ? query : {};
};

const assertBulkWriteIsSafe = (collectionName: string, operations: unknown): void => {
  if (!Array.isArray(operations)) {
    return;
  }

  for (const operation of operations) {
    if (!isPlainObject(operation)) {
      continue;
    }

    const deleteMany = operation.deleteMany;
    if (isPlainObject(deleteMany) && isEmptyQuery(deleteMany.filter)) {
      throw new DatabaseSafetyError(`Refusing bulkWrite deleteMany({}) on ${collectionName}.`, 403);
    }

    const deleteOne = operation.deleteOne;
    if (isPlainObject(deleteOne) && isEmptyQuery(deleteOne.filter)) {
      throw new DatabaseSafetyError(`Refusing bulkWrite deleteOne({}) on ${collectionName}.`, 403);
    }
  }
};

const patchNativeDatabaseGuards = (connection: Connection): void => {
  if (nativeGuardsInstalled || !connection.db) {
    return;
  }

  nativeGuardsInstalled = true;

  const originalDropDatabase = connection.db.dropDatabase.bind(connection.db);
  connection.db.dropDatabase = async (...args: unknown[]) => {
    await guardRiskyWriteOperation({
      collectionName: '*',
      operation: 'dropDatabase',
      query: {}
    });

    return originalDropDatabase(...(args as []));
  };

  const originalDropCollection = connection.db.dropCollection.bind(connection.db);
  connection.db.dropCollection = async (name: string, ...args: unknown[]) => {
    await guardRiskyWriteOperation({
      collectionName: name,
      operation: 'dropCollection',
      query: { name }
    });

    return originalDropCollection(name, ...(args as [any?]));
  };

  const nativeCollection = connection.db.collection('_db_safety_probe');
  const nativeCollectionPrototype = Object.getPrototypeOf(nativeCollection) as {
    deleteMany?: (...args: unknown[]) => Promise<unknown>;
    deleteOne?: (...args: unknown[]) => Promise<unknown>;
    updateMany?: (...args: unknown[]) => Promise<unknown>;
    bulkWrite?: (...args: unknown[]) => Promise<unknown>;
    drop?: (...args: unknown[]) => Promise<unknown>;
    __dbSafetyPatched?: boolean;
  };

  if (nativeCollectionPrototype && !nativeCollectionPrototype.__dbSafetyPatched) {
    const originalNativeDeleteMany = nativeCollectionPrototype.deleteMany;
    if (originalNativeDeleteMany) {
      nativeCollectionPrototype.deleteMany = async function patchedDeleteMany(this: { collectionName?: string }, ...args: unknown[]) {
        const collectionName = this.collectionName || 'unknown';
        const query = getNativeOperationQuery(args);

        await guardRiskyWriteOperation({
          collectionName,
          operation: 'deleteMany',
          query
        });

        return originalNativeDeleteMany.apply(this, args);
      };
    }

    const originalNativeDeleteOne = nativeCollectionPrototype.deleteOne;
    if (originalNativeDeleteOne) {
      nativeCollectionPrototype.deleteOne = async function patchedDeleteOne(this: { collectionName?: string }, ...args: unknown[]) {
        const collectionName = this.collectionName || 'unknown';
        const query = getNativeOperationQuery(args);

        await guardRiskyWriteOperation({
          collectionName,
          operation: 'deleteOne',
          query
        });

        return originalNativeDeleteOne.apply(this, args);
      };
    }

    const originalNativeUpdateMany = nativeCollectionPrototype.updateMany;
    if (originalNativeUpdateMany) {
      nativeCollectionPrototype.updateMany = async function patchedUpdateMany(this: { collectionName?: string }, ...args: unknown[]) {
        const collectionName = this.collectionName || 'unknown';
        const query = getNativeOperationQuery(args);
        const update = args[1];

        await guardRiskyWriteOperation({
          collectionName,
          operation: 'updateMany',
          query,
          update
        });

        return originalNativeUpdateMany.apply(this, args);
      };
    }

    const originalNativeBulkWrite = nativeCollectionPrototype.bulkWrite;
    if (originalNativeBulkWrite) {
      nativeCollectionPrototype.bulkWrite = async function patchedBulkWrite(this: { collectionName?: string }, ...args: unknown[]) {
        const collectionName = this.collectionName || 'unknown';
        assertBulkWriteIsSafe(collectionName, args[0]);

        await guardRiskyWriteOperation({
          collectionName,
          operation: 'bulkWrite',
          query: { operations: Array.isArray(args[0]) ? args[0].length : 'unknown' },
          update: { operationCount: Array.isArray(args[0]) ? args[0].length : 'unknown' }
        });

        return originalNativeBulkWrite.apply(this, args);
      };
    }

    const originalNativeDrop = nativeCollectionPrototype.drop;
    if (originalNativeDrop) {
      nativeCollectionPrototype.drop = async function patchedDrop(this: { collectionName?: string }, ...args: unknown[]) {
        const collectionName = this.collectionName || 'unknown';

        await guardRiskyWriteOperation({
          collectionName,
          operation: 'dropCollection',
          query: { name: collectionName }
        });

        return originalNativeDrop.apply(this, args);
      };
    }

    nativeCollectionPrototype.__dbSafetyPatched = true;
  }
};

export const installDatabaseSafetyGuards = (connection: Connection): void => {
  patchNativeDatabaseGuards(connection);

  if (queryGuardInstalled) {
    return;
  }

  queryGuardInstalled = true;
  const originalExec = Query.prototype.exec;

  Query.prototype.exec = async function guardedExec(...args: unknown[]) {
    const queryInstance = this as Query<any, any> & {
      op?: SupportedWriteOperation;
      mongooseCollection?: { name?: string };
    };
    const operation = queryInstance.op;

    if (operation && WRITE_OPERATIONS.has(operation)) {
      const collectionName = queryInstance.mongooseCollection?.name || queryInstance.model?.collection?.name || 'unknown';
      const query = (typeof queryInstance.getQuery === 'function' ? queryInstance.getQuery() : {}) as Record<string, unknown>;
      const update = typeof queryInstance.getUpdate === 'function' ? queryInstance.getUpdate() : undefined;

      await guardRiskyWriteOperation({
        collectionName,
        operation,
        query,
        update
      });
    }

    return originalExec.apply(this, args as []);
  };
};

export const getUsersCollectionCount = async (): Promise<number> => {
  try {
    // If mongoose isn't connected, we can't count
    if (mongoose.connection.readyState !== 1) {
      return 0;
    }

    // Try counting using the User model if it's already registered
    if (mongoose.models.User) {
      return await mongoose.models.User.countDocuments({});
    }

    // Fallback to native collection count
    return await mongoose.connection.collection('users').countDocuments({});
  } catch (error) {
    console.error('Error counting users for health check:', error);
    return 0;
  }
};
