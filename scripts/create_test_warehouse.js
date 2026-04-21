/**
 * سكربت إنشاء مستودع تجريبي لاختبار Sprint 1
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Drug = require('../models/Drug');
const connectDB = require('../config/db');

const run = async () => {
  console.log('⏳ Connecting to DB...');
  await connectDB();
  console.log('✅ Connected!');

  // 1. Create Warehouse A
  const existingA = await User.findOne({ email: 'warehouse_a@viatica.com' });
  let warehouseA;
  if (existingA) {
    warehouseA = existingA;
    console.log('ℹ️  مستودع A موجود مسبقاً');
  } else {
    warehouseA = await User.create({
      name: 'مستودع الشفاء',
      email: 'warehouse_a@viatica.com',
      password: 'password123',
      role: 'warehouse',
      isVerified: true,
      status: 'verified',
      phone: '0911111111'
    });
    console.log('✅ مستودع A تم إنشاؤه');
  }

  // 2. Create Warehouse B
  const existingB = await User.findOne({ email: 'warehouse_b@viatica.com' });
  let warehouseB;
  if (existingB) {
    warehouseB = existingB;
    console.log('ℹ️  مستودع B موجود مسبقاً');
  } else {
    warehouseB = await User.create({
      name: 'مستودع النور',
      email: 'warehouse_b@viatica.com',
      password: 'password123',
      role: 'warehouse',
      isVerified: true,
      status: 'verified',
      phone: '0922222222'
    });
    console.log('✅ مستودع B تم إنشاؤه');
  }

  // 3. Add sample drugs for Warehouse A
  const drugsA = [
    { name: 'أموكسيسيلين 500mg', genericName: 'Amoxicillin', category: 'antibiotic', quantity: 200, price: 15000, expiryDate: new Date('2027-06-01'), batchNumber: 'BA-001', manufacturer: 'فارماسي سورية', dosage: '500mg', dosageForm: 'Capsule', warehouse: warehouseA._id },
    { name: 'باراسيتامول 500mg', genericName: 'Paracetamol', category: 'analgesic', quantity: 500, price: 5000, expiryDate: new Date('2027-12-01'), batchNumber: 'BA-002', manufacturer: 'تاميكو', dosage: '500mg', dosageForm: 'Tablet', warehouse: warehouseA._id },
    { name: 'أزيثرومايسين 250mg', genericName: 'Azithromycin', category: 'antibiotic', quantity: 100, price: 25000, expiryDate: new Date('2027-03-01'), batchNumber: 'BA-003', manufacturer: 'فارماسي سورية', dosage: '250mg', dosageForm: 'Tablet', warehouse: warehouseA._id },
  ];

  // 4. Add sample drugs for Warehouse B
  const drugsB = [
    { name: 'إيبوبروفين 400mg', genericName: 'Ibuprofen', category: 'analgesic', quantity: 300, price: 8000, expiryDate: new Date('2027-09-01'), batchNumber: 'BB-001', manufacturer: 'المتحدة للأدوية', dosage: '400mg', dosageForm: 'Tablet', warehouse: warehouseB._id },
    { name: 'أموكسيسيلين 500mg', genericName: 'Amoxicillin', category: 'antibiotic', quantity: 150, price: 12000, expiryDate: new Date('2027-08-01'), batchNumber: 'BB-002', manufacturer: 'المتحدة للأدوية', dosage: '500mg', dosageForm: 'Capsule', warehouse: warehouseB._id },
  ];

  // Clear old test drugs and insert fresh
  for (const drug of [...drugsA, ...drugsB]) {
    const exists = await Drug.findOne({ name: drug.name, warehouse: drug.warehouse });
    if (!exists) {
      await Drug.create(drug);
      console.log(`  💊 تمت إضافة: ${drug.name} → ${drug.warehouse.equals(warehouseA._id) ? 'مستودع الشفاء' : 'مستودع النور'}`);
    }
  }

  console.log('\n🎉 جاهز للاختبار!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Admin:       final_admin@viatica.com / password123');
  console.log('🏭 مستودع الشفاء: warehouse_a@viatica.com / password123');
  console.log('🏭 مستودع النور:  warehouse_b@viatica.com / password123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
