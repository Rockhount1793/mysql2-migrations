# mysql2-migrations
    
    -Create and manager migrations in mysql from repositories with configuration "TYPE MODULE"
    
# resume

Especial thanks to "kawadhiya21"
This npm module is a modding on mysql-migrations from this user
link: https://github.com/kawadhiya21/mysql-migrations 

# disclaimer

    -this package has not been tested intensively
    -This package must be used with MODULE TYPE IMPORT, FROM
    -set config on package.json "type": "module"
    -NO compatible with MODULE EXPORT, REQUIRE

# configuration


- steep 1

    - install dependencies
    - should install 'mysql2' dependency in your projects first

```javascript
    npm i mysql2
    npm i mysql2-migrations
```

- steep 2

    - create a folder in root app with name 'mysql2-migrations'

- steep 3

    - add migrations_config.js file in 'mysql2-migrations' folder with next content
    - here include your credentials from mysql

```javascript

    import mysql from 'mysql2'
    import migration from 'mysql2-migrations'

    // configuration 'mysql' to connect database 
    
    const conn = mysql.createPool({
        'database': 'name_db',
        'user':'root',
        'password':'password',
        'host': '127.0.0.1',
        'port':'3306',
        'waitForConnections':true,
        'connectionLimit':10,
        'queueLimit':0
    })

    // configuration 'mysql2-migrations' to execute querys (Try not to change the preset parameters)

    const db_query = new migration.init()
    db_query.conn = conn
    db_query.root_path = 'mysql2-migrations/'
    db_query.migrations_folder = 'migrations'
    db_query.name_table_migrations = 'mysql_migrations_app'
    //db_query.cb = ()=>{ console.log('optional message at success') }
    db_query.start()

```

- steep 4

    - create a subfolder in 'mysql2-migrations' folder with name 'migrations'

    - root_app/
        - mysql2-migrations/
            - migrations_config.js
            - migrations/

- steep 5

    - Add commands to package.json configuration

```javascript

    "scripts": {
        "db_create": "node mysql2-migrations/migrations_config.js create",           
        "db_refresh": "node mysql2-migrations/migrations_config.js refresh",                
        "db_migrate_all": "node mysql2-migrations/migrations_config.js migrate",   
        "db_migrate": "node mysql2-migrations/migrations_config.js up",                   
        "db_rollback": "node mysql2-migrations/migrations_config.js down",                   
    }


```

    - description

    - "db_create"        // create file to migrate, example: npm run db_create create_users_table
    - "db_refresh"       // undo y redo all migrations (CAUTION DATA LOSS, It is not recommended to add it ) , example: npm run db_refresh
    - "db_migrate_all"   // migrate all files pending, example: npm run db_migrate_all
    - "db_migrate"       // migrate last file pending, example: npm run db_migrate
    - "db_rollback"      // undo latest migration,     example: npm run db_rollback 


    - too You can also UP or DOWN direct migrations, example:
    - ATENTION! ## DIRECT MIGRATIONS WILL NOT BE SAVED IN THE mysql_migrations_app TABLE

```javascript
    node mysql2-migrations/migrations_config.js run 1500891087394_create_table_users.js up
    node mysql2-migrations/migrations_config.js run 1500891087394_create_table_users.js down
```

# edit file migrations 

    - after add file to migrate, example:

```javascript

     npm run db_create create_users_table 

```
    
    - should to go 'migrations' folder and edit file, example:
    - PLEASE DO NOT MODIFY THE 'cb(e,r)' (debug FUNCTION), IT WILL REGISTER POSSIBLE ERRORS!!!

```javascript


export default {

    'up': function (conn, cb) {
        conn.query(
            `
            CREATE TABLE users(
                user_id BIGINT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                surname VARCHAR(100) NOT NULL,
                created_at DATETIME(6) NOT NULL,
                updated_at DATETIME(6) NOT NULL,
                PRIMARY KEY (user_id),
                UNIQUE INDEX user_id_UNIQUE (user_id ASC) VISIBLE
    
            `
            , function (e,r){ cb(e,r)})
    },

    'down': "DROP TABLE users"

}

```


# run migrations

    - Finally, run the migration with the command:

```javascript
    npm run db_migrate
```