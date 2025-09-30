// const express = require('express');
// const router = express.Router();
// const Maintenance = require('../models/Maintenance');
// const Generator = require('../models/Generator');
// const uploadMiddleware = require('../middlewares/uploadMiddleware');

// // 1. Get all maintenance records
// router.get('/', async (req, res) => {
//   try {
//     const allMaintenance = await Maintenance.find()
//       .sort({ date: -1 })
//       .lean();
//     res.json(allMaintenance);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post('/upload', 
//   uploadMiddleware.upload.array('images', 5),
//   uploadMiddleware.resizeImages,
//   async (req, res) => {
//     try {
//       const urls = req.files.map(file => `/public/images/${file.filename}`);
//       res.json({ urls });
//     } catch (err) {
//       res.status(500).json({ error: err.message });
//     }
//   }
// );

// // 2. Create Maintenance Record
// router.post('/', async (req, res) => {
//   try {
//     const generator = await Generator.findById(req.body.generator_id);
//     if (!generator) {
//       return res.status(400).json({ error: 'Generator not found' });
//     }

//     const maintenanceData = {
//       ...req.body,
//       date: req.body.date || new Date(),
//       completed: req.body.completed || false,
//       parts_replaced: Array.isArray(req.body.parts_replaced) 
//         ? req.body.parts_replaced.map(part => 
//             typeof part === 'string' ? { name: part, quantity: 1 } : part
//           )
//         : []
//     };

//     const maintenance = new Maintenance(maintenanceData);
//     await maintenance.save();
//     res.status(201).json(maintenance);
//   } catch (err) {
//     if (err.name === 'ValidationError') {
//       const messages = Object.values(err.errors).map(val => val.message);
//       return res.status(400).json({ error: messages });
//     }
//     res.status(500).json({ error: err.message });
//   }
// });

// // 3. Get Maintenance History for Generator
// router.get('/generator/:id', async (req, res) => {
//   try {
//     const generator = await Generator.findById(req.params.id);
//     if (!generator) {
//       return res.status(404).json({ error: 'Generator not found' });
//     }

//     const history = await Maintenance.find({ generator_id: req.params.id })
//       .sort({ date: -1 })
//       .lean();
//     res.json(history);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // 4. Update Maintenance Record
// router.put('/:id', async (req, res) => {
//   try {
//     const maintenance = await Maintenance.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, runValidators: true }
//     );

//     if (!maintenance) {
//       return res.status(404).json({ error: 'Maintenance record not found' });
//     }

//     if (maintenance.completed) {
//       await Generator.findByIdAndUpdate(
//         maintenance.generator_id,
//         { 
//           last_maintenance: maintenance.date,
//           $addToSet: { maintenance_history: maintenance._id }
//         }
//       );
//     }

//     res.json(maintenance);
//   } catch (err) {
//     if (err.name === 'ValidationError') {
//       const messages = Object.values(err.errors).map(val => val.message);
//       return res.status(400).json({ error: messages });
//     }
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;