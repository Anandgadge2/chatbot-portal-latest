/**
 * 🛡️ Helper to escape special characters for regex strings.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * 🔍 Helper to build a "Proper" multi-token search for names.
 * Supports splitting a search string into tokens (e.g. "Anand Gadge")
 * and matching both firstName and lastName across those tokens.
 * 
 * @param search The raw search string from the user.
 * @param firstNameField The field name in MongoDB for first name (default: "firstName").
 * @param lastNameField The field name in MongoDB for last name (default: "lastName").
 * @returns An array of $or conditions for MongoDB.
 */
export function buildNameSearchQuery(
  search: string, 
  firstNameField: string = 'firstName', 
  lastNameField: string = 'lastName'
): any[] {
  if (!search) return [];

  const escapedSearch = escapeRegExp(search.trim());
  const tokens = search.trim().split(/\s+/).map(t => escapeRegExp(t));
  const criteria: any[] = [];

  // ✨ 1. Universal Regex Match (Single field match across any field)
  criteria.push({ [firstNameField]: { $regex: escapedSearch, $options: 'i' } });
  criteria.push({ [lastNameField]: { $regex: escapedSearch, $options: 'i' } });

  // ✨ 2. Multi-Token Logic (For full names)
  if (tokens.length >= 2) {
    // Exact match for full string across both fields concatenated
    // (We use $and with regexes on both fields for tokens)
    criteria.push({
      $and: [
        { [firstNameField]: { $regex: tokens[0], $options: 'i' } },
        { [lastNameField]: { $regex: tokens[tokens.length - 1], $options: 'i' } }
      ]
    });
  }

  return criteria;
}
