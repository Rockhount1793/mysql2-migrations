#  Mysql2 Migrations :: Type module projects : Windows OS
    
- Create and manager migrations with mysql2 from repositories with configuration "TYPE MODULE"
- Only support windows os

# 📫 Disclaimer

- This package must be used with MODULE TYPE IMPORT AND FROM
- Set config on package.json "type": "module"
- NO compatible with MODULE EXPORT AND REQUIRE
- Due to various reasons between permissions and compatibility this package does NOT work on Linux, I am very sorry.

# 🧠 Configuration

- step 1

    - Install dependencies
    - Should install 'mysql2' dependency in your projects first

    ```javascript
    npm i mysql2
    npm i mysql2-migrations
    ```

- step 2

    - Execute script to add files configuration in environment (reminder: add credentials in Migration instance on finalize)
    
    ```javascript
    npx mysql2-migrations init
    ```
- step 3 (Optional configure environment yourself)
    
    - 1.Create a folder in root app with name "mysql2-migrations"
    - 2.Create a "migrations_config.js" file in "mysql2-migrations" folder with next configuration(add your db credentials here)

    ```javascript
    import Migration from 'mysql2-migrations'
    
    const db_query = new Migration()
    db_query.database = "test"
    db_query.user = "root"
    db_query.password = "password"
    db_query.host = "127.0.0.1"
    db_query.port = 3306
    db_query.name_table_migrations = "table_migrations_app"
    db_query.show_query = false
    db_query.show_depuration = false
    db_query.start()
    ```

    - 3.Create a subfolder "migrations" into "mysql2-migrations" folder:

        - root_app/
            - mysql2-migrations/
                - migrations_config.js
                - migrations/

    - 4.Add scripts commands to package.json configuration:

    ```javascript
        "scripts": {
            "db_create": "node mysql2-migrations/migrations_config.js create",           
            "db_refresh": "node mysql2-migrations/migrations_config.js refresh",                
            "db_migrate_all": "node mysql2-migrations/migrations_config.js migrate",   
            "db_migrate": "node mysql2-migrations/migrations_config.js up",                   
            "db_rollback": "node mysql2-migrations/migrations_config.js down",                   
        }
    ```

# 👋 Description script commnads
    
- **db_create**       
    #### Create file to migrate, examples: 
    ```javascript
    npm run db_create create_users_table
    ```
    ```javascript
    npm run db_create alter_sales_table
    ```
- **db_refresh**
    #### Undo y redo all migrations (CAUTION DATA LOSS, It is not recommended to add it ) , example: 
    ```javascript
    npm run db_refresh
    ```
- **db_migrate_all**  
    #### Migrate all files pending, example: 
    ```javascript    
    npm run db_migrate_all
    ```

- **db_migrate**
    #### Migrate last file pending, example: 
    ```javascript 
    npm run db_migrate
    ```

- **db_rollback**
    #### Undo latest migration,     example: 
    ```javascript     
    npm run db_rollback
    ```

- **too You can also UP or DOWN direct migrations**
    - DIRECT MIGRATIONS WILL NOT BE SAVED IN THE "mysql_migrations_app" TABLE
    - example:

    ```javascript
    node mysql2-migrations/migrations_config.js run 1667598634512_create_users_table.js up
    ```

# 👩‍💻 Add file migrations 

- Add file to migrate, example:

    ```javascript
    npm run db_create create_users_table 
    ```
 - Go to "migrations" folder and edit file with query, example:
    
    ```javascript
        export default {
            "description":"Create Users Table",
            "up":
                `
                CREATE TABLE users(
                    user_id BIGINT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                    name VARCHAR(100) NOT NULL,
                    surname VARCHAR(100) NOT NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (user_id),
                    UNIQUE INDEX user_id_UNIQUE (user_id ASC) VISIBLE)
                `
            ,
            "down":"DROP TABLE users"
        }
    ```

# :	⚡️ Run migrations

- Finally, run the migration with the command:

```javascript
npm run db_migrate
```