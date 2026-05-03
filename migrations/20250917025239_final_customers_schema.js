exports.up = async function(knex) {
  // 1. جدول customers (بدلاً من companies) - كما طلب
  await knex.schema.createTable('customers', (table) => {
    table.increments('customer_id').primary();
    table.string('first_name', 100).notNullable();
    table.string('second_name', 100).notNullable(); // كما طلب
    table.string('email', 255).unique().notNullable();
    table.text('address').nullable(); // سيتم تفصيله لاحقاً
    table.string('phone', 20).nullable();
    table.enu('customer_type', ['company', 'individual']).notNullable(); // كما طلب
    table.timestamp('registration_date').defaultTo(knex.fn.now()); // كما طلب
  });

  // 2. جدول users (مع التعديلات المطلوبة)
  await knex.schema.createTable('users', (table) => {
    table.increments('user_id').primary();
    table.integer('customer_id').unsigned().notNullable(); // تغيير من company_id
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable(); // last_name كما طلب
    table.string('phone', 20).nullable();
    table.enu('role', ['admin', 'user']).defaultTo('user');
    table.boolean('is_active').defaultTo(true); // ضروري لإدارة الحسابات
    table.timestamp('registration_date').defaultTo(knex.fn.now()); // كما طلب
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.foreign('customer_id').references('customer_id').inTable('customers');
  });

  // 3. جدول licenses (مع التعديلات المطلوبة)
  await knex.schema.createTable('licenses', (table) => {
    table.increments('license_id').primary();
    table.integer('customer_id').unsigned().notNullable(); // تغيير من company_id
    table.string('license_hash', 255).unique().notNullable();
    table.integer('seat_number').notNullable();
    table.date('issue_date').notNullable();
    table.date('expiration_date').notNullable();
    table.string('license_type', 50).defaultTo('floating'); // كما طلب - قيمة ثابتة
    table.string('username', 100).nullable();
    table.string('pc_uuid', 255).nullable();
    table.boolean('is_free').defaultTo(false);
    table.timestamp('last_activity').nullable();
    // تم إزالة status كما طلب
    
    table.foreign('customer_id').references('customer_id').inTable('customers');
  });

  // 4. جدول logs (كما هو)
  await knex.schema.createTable('logs', (table) => {
    table.increments('log_id').primary();
    table.integer('user_id').unsigned().nullable();
    table.string('action', 100).notNullable();
    table.text('details').nullable();
    table.string('ip_address', 45).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.foreign('user_id').references('user_id').inTable('users');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('logs');
  await knex.schema.dropTableIfExists('licenses');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('customers');
};