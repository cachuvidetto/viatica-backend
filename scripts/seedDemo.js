const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' }); // Ensure path is correct

const User = require('../models/User');
const Drug = require('../models/Drug');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');

// Connect to DB removed for module usage

const seedData = async () => {
  try {
    // 1. Find the Demo Warehouse or use the first warehouse found
    let warehouse = await User.findOne({ role: 'warehouse', email: /demo/i });
    if (!warehouse) {
      warehouse = await User.findOne({ role: 'warehouse' }); // Fallback to first warehouse
    }

    if (!warehouse) {
      console.log('No warehouse found! Creating a new Demo Warehouse...');
      warehouse = await User.create({
        name: 'مستودع ديمو المركزي',
        pharmacyName: 'مستودع ديمو للأدوية',
        phone: '0900000000',
        email: 'demo@viatica.com',
        password: 'demo123',
        role: 'warehouse',
        status: 'verified',
        isVerified: true,
        warehouseType: 'مستودع عام',
        managerName: 'د. ديمو'
      });
    }

    console.log(`Injecting data into Warehouse: ${warehouse.name}...`);

    // 2. Create Demo Pharmacists (Customers)
    console.log('Creating demo pharmacists...');
    const pharmacists = [];
    for (let i = 1; i <= 5; i++) {
      let p = await User.findOne({ phone: `091111111${i}` });
      if (!p) {
        p = await User.create({
          name: `د. صيدلاني ${i}`,
          pharmacyName: `صيدلية الشفاء ${i}`,
          phone: `091111111${i}`,
          password: 'password123',
          role: 'pharmacist',
          status: 'verified',
          isVerified: true
        });
      }
      pharmacists.push(p);
    }

    // 3. Create Suppliers
    console.log('Creating demo suppliers...');
    const suppliers = [];
    const supplierNames = ['ابن حيان', 'تاميكو', 'ميديكو', 'أوبري', 'الفا'];
    for (const sName of supplierNames) {
      let s = await Supplier.findOne({ name: sName, warehouse: warehouse._id });
      if (!s) {
        s = await Supplier.create({
          name: sName,
          company: `${sName} للصناعات الدوائية`,
          phone: `011${Math.floor(Math.random() * 1000000)}`,
          warehouse: warehouse._id
        });
      }
      suppliers.push(s);
    }

    // 4. Create Real-like Drugs
    console.log('Creating demo drugs...');
    await Drug.deleteMany({ warehouse: warehouse._id }); // Wipe only this warehouse's old demo drugs to avoid duplicates
    const realDrugs = [
      { name: 'Panadol Extra 500mg', genericName: 'Paracetamol', manufacturer: 'GSK', costPrice: 15000, price: 18000, category: 'analgesic', form: 'Tablet', qty: 500 },
      { name: 'Augmentin 1g', genericName: 'Amoxicillin + Clavulanate', manufacturer: 'GSK', costPrice: 45000, price: 54000, category: 'antibiotic', form: 'Tablet', qty: 200 },
      { name: 'Amoxil 500mg', genericName: 'Amoxicillin', manufacturer: 'GSK', costPrice: 12000, price: 14500, category: 'antibiotic', form: 'Capsule', qty: 300 },
      { name: 'Zyrtec 10mg', genericName: 'Cetirizine', manufacturer: 'UCB', costPrice: 18000, price: 22000, category: 'antihistamine', form: 'Tablet', qty: 150 },
      { name: 'Profinal 400mg', genericName: 'Ibuprofen', manufacturer: 'Julphar', costPrice: 9000, price: 11000, category: 'analgesic', form: 'Tablet', qty: 600 },
      { name: 'Concor 5mg', genericName: 'Bisoprolol', manufacturer: 'Merck', costPrice: 25000, price: 30000, category: 'other', form: 'Tablet', qty: 100 },
      { name: 'Lipitor 20mg', genericName: 'Atorvastatin', manufacturer: 'Pfizer', costPrice: 35000, price: 42000, category: 'other', form: 'Tablet', qty: 80 },
      { name: 'Nexium 40mg', genericName: 'Esomeprazole', manufacturer: 'AstraZeneca', costPrice: 40000, price: 48000, category: 'other', form: 'Tablet', qty: 120 },
      { name: 'Cataflam 50mg', genericName: 'Diclofenac', manufacturer: 'Novartis', costPrice: 16000, price: 19500, category: 'analgesic', form: 'Tablet', qty: 250 },
      { name: 'Eltroxin 100mcg', genericName: 'Levothyroxine', manufacturer: 'Aspen', costPrice: 10000, price: 12000, category: 'other', form: 'Tablet', qty: 400 },
      { name: 'Glucophage 850mg', genericName: 'Metformin', manufacturer: 'Merck', costPrice: 14000, price: 17000, category: 'other', form: 'Tablet', qty: 350 },
      { name: 'Voltaren Emulgel', genericName: 'Diclofenac', manufacturer: 'Novartis', costPrice: 22000, price: 26500, category: 'analgesic', form: 'Cream', qty: 90 },
      { name: 'Otrivin Adult', genericName: 'Xylometazoline', manufacturer: 'GSK', costPrice: 13000, price: 16000, category: 'other', form: 'Drops', qty: 180 },
      { name: 'Prospan Syrup', genericName: 'Ivy Leaf Extract', manufacturer: 'Engelhard', costPrice: 32000, price: 38500, category: 'other', form: 'Syrup', qty: 140 },
      { name: 'Centrum Lutein', genericName: 'Multivitamins', manufacturer: 'Pfizer', costPrice: 85000, price: 105000, category: 'other', form: 'Tablet', qty: 40 },
    ];

    const drugs = [];
    for (const d of realDrugs) {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + Math.floor(Math.random() * 3) + 1); // 1-3 years expiry
      
      const newDrug = await Drug.create({
        warehouse: warehouse._id,
        name: d.name,
        genericName: d.genericName,
        manufacturer: d.manufacturer,
        category: d.category,
        dosageForm: d.form,
        dosage: d.name.split(' ')[1] || '500mg',
        price: d.price,
        costPrice: d.costPrice,
        quantity: d.qty,
        batchNumber: `BATCH-${Math.floor(Math.random() * 10000)}`,
        expiryDate: futureDate,
        minThreshold: 50
      });
      drugs.push(newDrug);
    }

    // 5. Create Purchases (Inbound logic)
    console.log('Creating demo purchases...');
    await Purchase.deleteMany({ warehouse: warehouse._id });
    for (let i = 0; i < 10; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 30)); // random date in last 30 days
      
      const pItems = [];
      let totalCost = 0;
      // pick 3 random drugs
      for(let j=0; j<3; j++) {
        const rndDrug = drugs[Math.floor(Math.random() * drugs.length)];
        const qty = Math.floor(Math.random() * 50) + 10;
        const lineTotal = qty * rndDrug.costPrice;
        pItems.push({
          drug: rndDrug._id,
          drugName: rndDrug.name,
          quantity: qty,
          costPrice: rndDrug.costPrice,
          total: lineTotal,
          unitType: 'unit'
        });
        totalCost += lineTotal;
      }

      await Purchase.create({
        warehouse: warehouse._id,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)]._id,
        invoiceNumber: `INV-P-${Math.floor(Math.random()*10000)}`,
        items: pItems,
        subtotal: totalCost,
        total: totalCost,
        discount: 0,
        paymentStatus: Math.random() > 0.5 ? 'paid' : 'credit',
        date: pastDate
      });
    }

    // 6. Create Sales Orders (Outbound)
    console.log('Creating demo sales orders...');
    await Order.deleteMany({ warehouse: warehouse._id });
    for (let i = 0; i < 20; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 30)); 
      
      const sItems = [];
      let totalSale = 0;
      let totalCostGoods = 0;
      for(let j=0; j<2; j++) {
        const rndDrug = drugs[Math.floor(Math.random() * drugs.length)];
        const qty = Math.floor(Math.random() * 10) + 1;
        sItems.push({
          drug: rndDrug._id,
          drugName: rndDrug.name,
          quantity: qty,
          price: rndDrug.price,
          costPrice: rndDrug.costPrice
        });
        totalSale += (qty * rndDrug.price);
        totalCostGoods += (qty * rndDrug.costPrice);
      }

      const orderStatuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];
      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

      await Order.create({
        warehouse: warehouse._id,
        pharmacist: pharmacists[Math.floor(Math.random() * pharmacists.length)]._id,
        source: 'manual_pharmacy',
        status: status,
        paymentType: Math.random() > 0.3 ? 'credit' : 'cash',
        drugs: sItems,
        totalAmount: totalSale,
        createdAt: pastDate,
        updatedAt: pastDate
      });
    }

    // 7. Create Expenses
    console.log('Creating demo expenses...');
    await Expense.deleteMany({ warehouse: warehouse._id });
    const expenseCategories = ['رواتب', 'إيجار', 'كهرباء/ماء', 'نقل وشحن', 'ضيافة'];
    for(let i=0; i<5; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 30)); 
      
      await Expense.create({
        warehouse: warehouse._id,
        title: `دفع ${expenseCategories[Math.floor(Math.random()*expenseCategories.length)]}`,
        category: 'other',
        amount: Math.floor(Math.random() * 500000) + 50000,
        date: pastDate
      });
    }

    console.log('✅ Demo Seed Data successfully injected!');
    return true;

  } catch (error) {
    console.error('❌ Error in Seeding Data:', error);
    throw error;
  }
};

module.exports = seedData;
