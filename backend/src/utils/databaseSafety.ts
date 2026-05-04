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
  operation: SupportedWriteOperation;
  query: Record<string, unknown>;
  update?: unknown;
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

const isBulkOperation = (operation: SupportedWriteOperation): boolean => {
  return operation === 'deleteMany' || operation === 'updateMany';
};

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const logWriteAttempt = ({ collectionName, operation, query, update }: RiskyOperationContext): void => {
  logger.warn(
    JSON.stringify({
      type: 'db-write-attempt',
      collectionName,
      operation,
      query,
      update,
      timestamp: new Date().toISOString()
    })
  );
};

const assertWriteIsSafe = ({ collectionName, operation, query }: RiskyOperationContext): void => {
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

const patchNativeDatabaseGuards = (connection: Connection): void => {
  if (nativeGuardsInstalled || !connection.db) {
    return;
  }

  nativeGuardsInstalled = true;

  const originalDropDatabase = connection.db.dropDatabase.bind(connection.db);
  connection.db.dropDatabase = async (...args: unknown[]) => {
    if (isProduction()) {
      throw new DatabaseSafetyError('dropDatabase() is blocked in production.', 403);
    }

    logger.warn(
      JSON.stringify({
        type: 'db-drop-database-attempt',
        timestamp: new Date().toISOString()
      })
    );

    return originalDropDatabase(...(args as []));
  };

  const originalDropCollection = connection.db.dropCollection.bind(connection.db);
  connection.db.dropCollection = async (name: string, ...args: unknown[]) => {
    if (isProduction()) {
      throw new DatabaseSafetyError(`collection.drop() is blocked in production for ${name}.`, 403);
    }

    logger.warn(
      JSON.stringify({
        type: 'db-drop-collection-attempt',
        collectionName: name,
        timestamp: new Date().toISOString()
      })
    );

    return originalDropCollection(name, ...(args as [any?]));
  };

  const nativeCollection = connection.db.collection('_db_safety_probe');
  const nativeCollectionPrototype = Object.getPrototypeOf(nativeCollection) as {
    drop?: (...args: unknown[]) => Promise<unknown>;
    __dbSafetyPatched?: boolean;
  };

  if (nativeCollectionPrototype?.drop && !nativeCollectionPrototype.__dbSafetyPatched) {
    nativeCollectionPrototype.drop = async function patchedDrop(this: { collectionName?: string }, ...args: unknown[]) {
      const collectionName = this.collectionName || 'unknown';

      if (isProduction()) {
        throw new DatabaseSafetyError(`collection.drop() is blocked in production for ${collectionName}.`, 403);
      }

      logger.warn(
        JSON.stringify({
          type: 'db-native-collection-drop-attempt',
          collectionName,
          timestamp: new Date().toISOString()
        })
      );

      return connection.db!.dropCollection(collectionName, ...(args as [any?]));
    };

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
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  return mongoose.connection.collection('users').countDocuments({});
};
