exports.up = async function(knex) {
  // 1. تحديث جدول customers - إضافة الحقول الجديدة
  await knex.schema.alterTable('customers', (table) => {
    // تغيير second_name إلى last_name
    table.renameColumn('second_name', 'last_name');
    
    // إضافة حقول الشركة والعناوين المفصلة
    table.string('company_name', 255).nullable().after('customer_type');
    
    // عنوان العميل المفصل
    table.string('cust_street', 255).nullable().after('address');
    table.string('cust_building', 50).nullable();
    table.string('cust_city', 100).nullable();
    table.string('cust_state', 100).nullable();
    table.string('cust_postal_code', 20).nullable();
    table.string('cust_country', 100).nullable();
    
 
  });

  // 2. تحديث جدول users - إضافة عنوان المسؤول
  await knex.schema.alterTable('users', (table) => {
    // عنوان المسؤول المفصل
    table.string('mgr_street', 255).nullable();
    table.string('mgr_building', 50).nullable();
    table.string('mgr_city', 100).nullable();
    table.string('mgr_state', 100).nullable();
    table.string('mgr_postal_code', 20).nullable();
    table.string('mgr_country', 100).nullable();
  });
};

exports.down = async function(knex) {
  // التراجع عن التغييرات
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('mgr_street');
    table.dropColumn('mgr_building');
    table.dropColumn('mgr_city');
    table.dropColumn('mgr_state');
    table.dropColumn('mgr_postal_code');
    table.dropColumn('mgr_country');
  });

  await knex.schema.alterTable('customers', (table) => {
    table.renameColumn('last_name', 'second_name');
    table.dropColumn('company_name');
    table.dropColumn('cust_street');
    table.dropColumn('cust_building');
    table.dropColumn('cust_city');
    table.dropColumn('cust_state');
    table.dropColumn('cust_postal_code');
    table.dropColumn('cust_country');
   
});
};