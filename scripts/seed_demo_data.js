const mongoose = require('mongoose');
const Drug = require('../models/Drug');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const demoDrugs = [
  {
    name: "بانادول إكسترا - Panadol Extra",
    genericName: "Paracetamol 500mg, Caffeine 65mg",
    category: "analgesic",
    manufacturer: "GSK",
    dosage: "500 mg",
    dosageForm: "Tablet",
    price: 15000,
    quantity: 500,
    expiryDate: new Date('2027-12-01'),
    batchNumber: "B-88392",
    barcode: "6281000001010",
    description: "مسكن ألم فعال وسريع مع الكافيين لتسكين الصداع والآلام العامة.",
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "أوجمنتين - Augmentin 1g",
    genericName: "Amoxicillin + Clavulanate Potassium",
    category: "antibiotic",
    manufacturer: "GSK",
    dosage: "1 g",
    dosageForm: "Tablet",
    price: 45000,
    quantity: 120,
    expiryDate: new Date('2026-05-15'),
    batchNumber: "AUG-102",
    barcode: "6281000001027",
    description: "مضاد حيوي واسع الطيف لعلاج الالتهابات البكتيرية في الجهاز التنفسي والمسالك.",
    imageUrl: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "سنتروم - Centrum Adults",
    genericName: "Multivitamin / Multimineral Supplement",
    category: "other",
    manufacturer: "Pfizer",
    dosage: "500 mg",
    dosageForm: "Tablet",
    price: 85000,
    quantity: 40,
    expiryDate: new Date('2028-01-10'),
    batchNumber: "CEN-554",
    barcode: "6281000001034",
    description: "مكمل غذائي متكامل يحتوي على الفيتامينات والمعادن لدعم المناعة والطاقة.",
    imageUrl: "https://images.unsplash.com/photo-1577401239170-897942555fb3?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "بروفين - Brufen 400mg",
    genericName: "Ibuprofen 400mg",
    category: "analgesic",
    manufacturer: "Abbott",
    dosage: "400 mg",
    dosageForm: "Tablet",
    price: 12000,
    quantity: 300,
    expiryDate: new Date('2026-08-20'),
    batchNumber: "BRU-009",
    barcode: "6281000001041",
    description: "مسكن آلام ومضاد للالتهابات الروماتيزمية وخافض للحرارة.",
    imageUrl: "https://images.unsplash.com/photo-1550572017-edb7be0e4986?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "لورين - Lorin 10mg",
    genericName: "Loratadine 10mg",
    category: "other",
    manufacturer: "Deef",
    dosage: "10 mg",
    dosageForm: "Tablet",
    price: 18000,
    quantity: 150,
    expiryDate: new Date('2025-11-30'),
    batchNumber: "LOR-771",
    barcode: "6281000001058",
    description: "مضاد هيستامين لا يسبب النعاس، يخفف أعراض الحساسية والزكام.",
    imageUrl: "https://images.unsplash.com/photo-1585435557343-3b092031a831?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "ديسفلاتيل - Disflatyl",
    genericName: "Simethicone 40MG",
    category: "other",
    manufacturer: "Misr",
    dosage: "40 mg",
    dosageForm: "Tablet",
    price: 21000,
    quantity: 80,
    expiryDate: new Date('2027-02-14'),
    batchNumber: "DIS-112",
    barcode: "6281000001065",
    description: "أقراص للمضغ لعلاج الانتفاخ والغازات وتطبل البطن المزعج.",
    imageUrl: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "أوميبرازول - Omeprazole 20mg",
    genericName: "Omeprazole",
    category: "other",
    manufacturer: "AstraZeneca",
    dosage: "20 mg",
    dosageForm: "Capsule",
    price: 32000,
    quantity: 200,
    expiryDate: new Date('2026-09-01'),
    batchNumber: "OME-402",
    barcode: "6281000001072",
    description: "علاج حموضة المعدة، القرحة وارتجاع المريء.",
    imageUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  },
  {
    name: "فولتارين جيـل - Voltaren Emulgel",
    genericName: "Diclofenac Diethylamine",
    category: "analgesic",
    manufacturer: "Novartis",
    dosage: "1 %",
    dosageForm: "Ointment",
    price: 29000,
    quantity: 60,
    expiryDate: new Date('2026-12-10'),
    batchNumber: "VOL-GEL-9",
    barcode: "6281000001089",
    description: "مسكن موضعي فعال لآلام المفاصل والعضلات والكدمات.",
    imageUrl: "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
  }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/viatica').then(async () => {
    console.log('Connected to DB');
    
    try {
        // Find a verified warehouse
        const warehouse = await User.findOne({ role: 'warehouse', status: 'verified' });
        if (!warehouse) {
            console.log('❌ No verified warehouse found. Please create one from Dashboard first!');
            process.exit(1);
        }

        console.log(`📦 Found Warehouse: ${warehouse.name}. Injecting demo drugs...`);

        // Insert new drugs securely
        let count = 0;
        for (const data of demoDrugs) {
            // Check if drug exists to avoid duplicates
            const exists = await Drug.findOne({ barcode: data.barcode, warehouse: warehouse._id });
            if (!exists) {
                await Drug.create({ ...data, warehouse: warehouse._id });
                count++;
            }
        }
        
        console.log(`✅ Success: Injected ${count} new demo drugs!`);
        process.exit(0);
    } catch (err) {
        console.error('Error during seeding:', err);
        process.exit(1);
    }
});
