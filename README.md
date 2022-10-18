# mysql-migrations-module
Create and manager migrations in mysql from repositories with configuration "type module"

# resume

Especial thanks to "kawadhiya21"
This npm module is a modding on mysql-migrations from this user
link: https://github.com/kawadhiya21/mysql-migrations 

# disclaimer

    -this package has not been tested intensively
    -This package must be used with MODULE TYPE IMPORT, FROM
    -set config on package.json "type": "module"
    -no compatible with MODULE EXPORT, REQUIRE

# configuration

- install

- steep 1

    npm i mysql2
    npm i mysql2-migrations-module

- steep 2

    create a folder in root app with name 'mysql2-migrations'

- steep 3

    add migrations_config.js file in 'mysql2-migrations' folder with next content

```javascript

    import mysql from 'mysql2'
    import migration from 'mysql2-migrations-module'

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

    // configuration 'mysql2-migrations-module' to execute querys (Try not to change the preset parameters)

    const db_query = new migration.init()
    db_query.conn = conn
    db_query.root_path = 'mysql2-migrations/'
    db_query.migrations_folder = 'migrations'
    db_query.name_table_migrations = 'mysql_migrations_app'
    //db_query.cb = ()=>{ console.log('optional message') }
    db_query.start()

```

- steep 4

    create a subfolder in 'mysql2-migrations' folder with name 'migrations'

    root_app/
        mysql2-migrations/
            migrations

- steep 5

    Add commands to package.json configuration

```javascript

    "scripts": {
        "db_create": "node mysql2-migrations/migrations_config.js add migration",           // create file to migrate, example: npm run db_create create_users_table
        "db_refresh": "node mysql2-migrations/migrations_config.js refresh",                // undo y redo all migrations (CAUTION DATA LOSS, It is not recommended to add it ) , example: npm run db_refresh
        "db_migrate_all": "node mysql2-migrations/migrations_config.js up --migrate-all",   // migrate all files pending, example: npm run db_migrate_all
        "db_migrate": "node mysql2-migrations/migrations_config.js up 1",                   // migrate last file pending, example: npm run db_migrate
        "db_rollback": "node mysql2-migrations/migrations_config.js down",                  // undo latest migration,     example: npm run db_rollback 
    }


```

# edit file migrations 

    after add file to migrate, example: npm run db_create create_users_table, 
    should to go 'migrations' folder and edit file, example:

```javascript

    // Remember to use only one of the examples, Choose one of the two ways

    export default {
    
        'up': function (conn, cb) {
            conn.query("CREATE TABLE users (user_id INT NOT NULL, UNIQUE KEY user_id (user_id), name TEXT )", function (err, res) {
                cb(
                    console.info(' Hello from users migration process.. '),
                    console.info(res)
                )
            })
        },

        'down': "DROP TABLE users"
    }

    //or use simple syntax 
    
    export default {
    
        'up':"CREATE TABLE users (user_id INT NOT NULL, UNIQUE KEY user_id (user_id), name TEXT )",
        'down': "DROP TABLE users"

    }

```

    