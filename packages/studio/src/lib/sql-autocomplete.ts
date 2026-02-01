import type { languages } from 'monaco-editor'

// SQL Keywords
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'NOT', 'NULL',
  'DEFAULT', 'CHECK', 'INDEX', 'VIEW', 'TRIGGER', 'BEGIN', 'END',
  'TRANSACTION', 'COMMIT', 'ROLLBACK', 'AS', 'ON', 'JOIN', 'LEFT',
  'RIGHT', 'INNER', 'OUTER', 'CROSS', 'UNION', 'INTERSECT', 'EXCEPT',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'DISTINCT', 'ALL', 'AND', 'OR', 'IN', 'BETWEEN', 'LIKE', 'GLOB',
  'IS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'CAST', 'EXISTS',
  'PRAGMA', 'EXPLAIN', 'QUERY', 'PLAN', 'ANALYZE', 'ATTACH', 'DETACH',
  'DATABASE', 'VACUUM', 'REINDEX'
]

// SQLite Data Types
const SQL_TYPES = [
  'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC',
  'INT', 'VARCHAR', 'CHAR', 'BOOLEAN', 'DATE', 'DATETIME',
  'DECIMAL', 'DOUBLE', 'FLOAT', 'TIMESTAMP'
]

// SQLite Built-in Functions
const SQL_FUNCTIONS = [
  // Aggregate functions
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT',
  
  // String functions
  'LENGTH', 'LOWER', 'UPPER', 'SUBSTR', 'SUBSTRING', 'TRIM', 'LTRIM', 'RTRIM',
  'REPLACE', 'INSTR', 'LIKE', 'GLOB', 'CONCAT', 'PRINTF',
  
  // Date/Time functions
  'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME', 'CURRENT_DATE',
  'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  
  // Math functions
  'ABS', 'RANDOM', 'ROUND', 'CEIL', 'CEILING', 'FLOOR', 'POWER', 'SQRT',
  'EXP', 'LN', 'LOG', 'LOG10', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN',
  
  // Type conversion
  'CAST', 'TYPEOF', 'COALESCE', 'IFNULL', 'NULLIF',
  
  // JSON functions (SQLite 3.38+)
  'JSON', 'JSON_ARRAY', 'JSON_OBJECT', 'JSON_EXTRACT', 'JSON_VALID',
  
  // Other functions
  'ROWID', 'LAST_INSERT_ROWID', 'CHANGES', 'TOTAL_CHANGES',
  'HEX', 'UNHEX', 'QUOTE', 'RANDOMBLOB', 'ZEROBLOB'
]

// SQL Snippets
const SQL_SNIPPETS = [
  {
    label: 'CREATE TABLE',
    insertText: `CREATE TABLE \${1:table_name} (
  \${2:id} INTEGER PRIMARY KEY AUTOINCREMENT,
  \${3:column_name} \${4:TEXT} \${5:NOT NULL}
);`,
    documentation: 'Create a new table with primary key',
    detail: 'Snippet'
  },
  {
    label: 'SELECT *',
    insertText: 'SELECT * FROM \${1:table_name}\${2: WHERE \${3:condition}};',
    documentation: 'Select all columns from table',
    detail: 'Snippet'
  },
  {
    label: 'INSERT INTO',
    insertText: `INSERT INTO \${1:table_name} (\${2:columns})
VALUES (\${3:values});`,
    documentation: 'Insert new row',
    detail: 'Snippet'
  },
  {
    label: 'UPDATE',
    insertText: `UPDATE \${1:table_name}
SET \${2:column} = \${3:value}
WHERE \${4:condition};`,
    documentation: 'Update existing rows',
    detail: 'Snippet'
  },
  {
    label: 'DELETE FROM',
    insertText: 'DELETE FROM \${1:table_name} WHERE \${2:condition};',
    documentation: 'Delete rows from table',
    detail: 'Snippet'
  },
  {
    label: 'JOIN',
    insertText: `SELECT *
FROM \${1:table1}
\${2|INNER,LEFT,RIGHT,FULL|} JOIN \${3:table2}
  ON \${1:table1}.\${4:column1} = \${3:table2}.\${5:column2};`,
    documentation: 'Join two tables',
    detail: 'Snippet'
  },
  {
    label: 'CREATE INDEX',
    insertText: 'CREATE INDEX \${1:index_name} ON \${2:table_name}(\${3:column_name});',
    documentation: 'Create an index',
    detail: 'Snippet'
  },
  {
    label: 'ALTER TABLE ADD',
    insertText: 'ALTER TABLE \${1:table_name} ADD COLUMN \${2:column_name} \${3:TEXT};',
    documentation: 'Add column to existing table',
    detail: 'Snippet'
  },
  {
    label: 'GROUP BY',
    insertText: `SELECT \${1:column}, COUNT(*)
FROM \${2:table_name}
GROUP BY \${1:column};`,
    documentation: 'Group and aggregate data',
    detail: 'Snippet'
  },
  {
    label: 'CASE WHEN',
    insertText: `CASE
  WHEN \${1:condition} THEN \${2:result}
  ELSE \${3:default}
END`,
    documentation: 'Conditional expression',
    detail: 'Snippet'
  }
]

interface TableSchema {
  name: string
  columns: Array<{
    name: string
    type: string
  }>
}

export class SQLCompletionProvider implements languages.CompletionItemProvider {
  private tables: TableSchema[] = []

  constructor(tables: TableSchema[] = []) {
    this.tables = tables
  }

  updateTables(tables: TableSchema[]) {
    this.tables = tables
  }

  provideCompletionItems(
    model: any,
    position: any
  ): languages.ProviderResult<languages.CompletionList> {
    const word = model.getWordUntilPosition(position)
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    }

    const suggestions: languages.CompletionItem[] = []

    // Get current line text for context
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    })

    const upperText = textUntilPosition.toUpperCase()

    // Add SQL Keywords
    SQL_KEYWORDS.forEach(keyword => {
      suggestions.push({
        label: keyword,
        kind: 14, // Keyword
        insertText: keyword,
        range,
        detail: 'SQL Keyword',
        sortText: '1_' + keyword
      })
    })

    // Add SQL Types
    SQL_TYPES.forEach(type => {
      suggestions.push({
        label: type,
        kind: 12, // Class (using for types)
        insertText: type,
        range,
        detail: 'Data Type',
        sortText: '2_' + type
      })
    })

    // Add SQL Functions
    SQL_FUNCTIONS.forEach(func => {
      suggestions.push({
        label: func,
        kind: 1, // Function
        insertText: `${func}($0)`,
        insertTextRules: 4, // InsertAsSnippet
        range,
        detail: 'SQL Function',
        documentation: `SQLite built-in function: ${func}()`,
        sortText: '3_' + func
      })
    })

    // Add Table Names (context-aware)
    if (upperText.includes('FROM') || upperText.includes('JOIN') || 
        upperText.includes('INTO') || upperText.includes('UPDATE')) {
      this.tables.forEach(table => {
        suggestions.push({
          label: table.name,
          kind: 7, // Class (using for tables)
          insertText: table.name,
          range,
          detail: 'Table',
          documentation: `Columns: ${table.columns.map(c => c.name).join(', ')}`,
          sortText: '0_' + table.name // Higher priority
        })
      })
    }

    // Add Column Names (context-aware)
    if (upperText.includes('SELECT') || upperText.includes('WHERE') || 
        upperText.includes('SET') || upperText.includes('ORDER') ||
        upperText.includes('GROUP')) {
      
      // Try to determine which table we're working with
      const tables = this.getReferencedTables(textUntilPosition)
      
      tables.forEach(tableName => {
        const table = this.tables.find(t => t.name === tableName)
        if (table) {
          table.columns.forEach(column => {
            suggestions.push({
              label: column.name,
              kind: 4, // Field
              insertText: column.name,
              range,
              detail: `Column (${table.name}.${column.name})`,
              documentation: `Type: ${column.type}`,
              sortText: '0_' + column.name
            })
          })
        }
      })
    }

    // Add Snippets
    SQL_SNIPPETS.forEach(snippet => {
      suggestions.push({
        label: snippet.label,
        kind: 15, // Snippet
        insertText: snippet.insertText,
        insertTextRules: 4, // InsertAsSnippet
        range,
        detail: snippet.detail,
        documentation: snippet.documentation,
        sortText: '4_' + snippet.label
      })
    })

    return { suggestions }
  }

  private getReferencedTables(text: string): string[] {
    const tables: string[] = []
    const upperText = text.toUpperCase()

    // Extract table names from FROM clause
    const fromMatch = upperText.match(/FROM\s+(\w+)/g)
    if (fromMatch) {
      fromMatch.forEach(match => {
        const tableName = match.replace(/FROM\s+/i, '').trim()
        if (this.tables.find(t => t.name.toUpperCase() === tableName)) {
          tables.push(this.tables.find(t => t.name.toUpperCase() === tableName)!.name)
        }
      })
    }

    // Extract table names from JOIN clause
    const joinMatch = upperText.match(/JOIN\s+(\w+)/g)
    if (joinMatch) {
      joinMatch.forEach(match => {
        const tableName = match.replace(/JOIN\s+/i, '').trim()
        if (this.tables.find(t => t.name.toUpperCase() === tableName)) {
          tables.push(this.tables.find(t => t.name.toUpperCase() === tableName)!.name)
        }
      })
    }

    // Extract table name from UPDATE clause
    const updateMatch = upperText.match(/UPDATE\s+(\w+)/i)
    if (updateMatch) {
      const tableName = updateMatch[1]
      if (this.tables.find(t => t.name.toUpperCase() === tableName)) {
        tables.push(this.tables.find(t => t.name.toUpperCase() === tableName)!.name)
      }
    }

    return tables
  }
}

// SQL Signature Help Provider (for function parameters)
export class SQLSignatureHelpProvider implements languages.SignatureHelpProvider {
  signatureHelpTriggerCharacters = ['(', ',']
  
  provideSignatureHelp(
    model: any,
    position: any
  ): languages.ProviderResult<languages.SignatureHelpResult> {
    // Get the word before the cursor
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    })

    // Simple function signature detection
    const functionMatch = textUntilPosition.match(/(\w+)\s*\([^)]*$/i)
    if (!functionMatch) return null

    const functionName = functionMatch[1].toUpperCase()

    // Define signatures for common functions
    const signatures: Record<string, languages.SignatureInformation> = {
      'SUBSTR': {
        label: 'SUBSTR(string, start, length)',
        documentation: 'Returns a substring',
        parameters: [
          { label: 'string', documentation: 'The input string' },
          { label: 'start', documentation: 'Starting position (1-based)' },
          { label: 'length', documentation: 'Length of substring' }
        ]
      },
      'REPLACE': {
        label: 'REPLACE(string, old, new)',
        documentation: 'Replaces occurrences of old with new',
        parameters: [
          { label: 'string', documentation: 'The input string' },
          { label: 'old', documentation: 'String to replace' },
          { label: 'new', documentation: 'Replacement string' }
        ]
      },
      'DATE': {
        label: 'DATE(timestring, modifier, ...)',
        documentation: 'Returns date in YYYY-MM-DD format',
        parameters: [
          { label: 'timestring', documentation: 'Time value' },
          { label: 'modifier', documentation: 'Optional modifier (+1 day, etc.)' }
        ]
      },
      'ROUND': {
        label: 'ROUND(number, decimals)',
        documentation: 'Rounds number to specified decimals',
        parameters: [
          { label: 'number', documentation: 'Number to round' },
          { label: 'decimals', documentation: 'Number of decimal places' }
        ]
      },
      'COALESCE': {
        label: 'COALESCE(value1, value2, ...)',
        documentation: 'Returns first non-null value',
        parameters: [
          { label: 'value1', documentation: 'First value' },
          { label: 'value2', documentation: 'Second value' }
        ]
      }
    }

    const signature = signatures[functionName]
    if (!signature) return null

    return {
      value: {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: 0
      },
      dispose: () => {}
    }
  }
}

// Hover Provider (shows documentation on hover)
export class SQLHoverProvider implements languages.HoverProvider {
  private tables: TableSchema[] = []

  constructor(tables: TableSchema[] = []) {
    this.tables = tables
  }

  updateTables(tables: TableSchema[]) {
    this.tables = tables
  }

  provideHover(model: any, position: any): languages.ProviderResult<languages.Hover> {
    const word = model.getWordAtPosition(position)
    if (!word) return null

    const wordText = word.word.toUpperCase()

    // Check if it's a keyword
    if (SQL_KEYWORDS.includes(wordText)) {
      return {
        contents: [
          { value: `**${wordText}**` },
          { value: 'SQL Keyword' }
        ]
      }
    }

    // Check if it's a function
    if (SQL_FUNCTIONS.includes(wordText)) {
      return {
        contents: [
          { value: `**${wordText}()**` },
          { value: 'SQLite built-in function' }
        ]
      }
    }

    // Check if it's a table
    const table = this.tables.find(t => t.name === word.word)
    if (table) {
      const columns = table.columns.map(c => `- **${c.name}**: ${c.type}`).join('\n')
      return {
        contents: [
          { value: `**Table: ${table.name}**` },
          { value: `\nColumns:\n${columns}` }
        ]
      }
    }

    // Check if it's a column
    for (const table of this.tables) {
      const column = table.columns.find(c => c.name === word.word)
      if (column) {
        return {
          contents: [
            { value: `**Column: ${column.name}**` },
            { value: `Table: ${table.name}` },
            { value: `Type: ${column.type}` }
          ]
        }
      }
    }

    return null
  }
}