const express = require('express');
const router = express.Router();

// Mock data
const restaurants = [
  { id: 1, name: 'مطعم البيتزا الملكية', cuisine_type: 'بيتزا', location: 'شارع الملك فهد', rating: 4.5, image_url: 'https://picsum.photos/seed/delev-0/1200/800', phone: '0555000001', opening_hours: '10:00-23:00' },
  { id: 2, name: 'مطعم السوشي الطازج', cuisine_type: 'سوشي', location: 'شارع التحلية', rating: 4.2, image_url: 'https://picsum.photos/seed/delev-1/1200/800', phone: '0555000002', opening_hours: '12:00-22:00' },
  { id: 3, name: 'مطعم البرجر الأمريكي', cuisine_type: 'برجر', location: 'شارع العليا', rating: 4.0, image_url: 'https://picsum.photos/seed/delev-2/1200/800', phone: '0555000003', opening_hours: '11:00-01:00' },
  { id: 4, name: 'مطعم المأكولات البحرية', cuisine_type: 'مأكولات بحرية', location: 'الكورنيش', rating: 4.8, image_url: 'https://picsum.photos/seed/delev-3/1200/800', phone: '0555000004', opening_hours: '12:00-23:00' },
  { id: 5, name: 'مطعم الفلافل اللبناني', cuisine_type: 'لبناني', location: 'شارع البطحاء', rating: 4.1, image_url: 'https://picsum.photos/seed/delev-4/1200/800', phone: '0555000005', opening_hours: '09:00-22:00' },
  { id: 6, name: 'مطعم الباستا الإيطالية', cuisine_type: 'إيطالي', location: 'شارع التخصصي', rating: 4.3, image_url: 'https://picsum.photos/seed/delev-5/1200/800', phone: '0555000006', opening_hours: '12:00-23:00' },
  { id: 7, name: 'مطعم الكباب التركي', cuisine_type: 'تركي', location: 'شارع الستين', rating: 4.6, image_url: 'https://picsum.photos/seed/delev-0/1200/800', phone: '0555000007', opening_hours: '11:00-23:00' },
  { id: 8, name: 'مطعم الدجاج المشوي', cuisine_type: 'مشاوي', location: 'شارع الأمير محمد بن عبدالعزيز', rating: 4.4, image_url: 'https://picsum.photos/seed/delev-1/1200/800', phone: '0555000008', opening_hours: '12:00-00:00' },
  { id: 9, name: 'مطعم الحلويات الشرقية', cuisine_type: 'حلويات', location: 'شارع الثلاثين', rating: 4.7, image_url: 'https://picsum.photos/seed/delev-2/1200/800', phone: '0555000009', opening_hours: '10:00-23:00' },
  { id: 10, name: 'مطعم الصحة الطبيعية', cuisine_type: 'صحي', location: 'شارع المطار', rating: 4.0, image_url: 'https://picsum.photos/seed/delev-3/1200/800', phone: '0555000010', opening_hours: '08:00-22:00' }
];

// GET /api/restaurants
router.get('/', (req, res) => {
  let result = [...restaurants];

  // Filter by name
  if (req.query.name) {
    const nameFilter = req.query.name.toLowerCase();
    result = result.filter(r => r.name.toLowerCase().includes(nameFilter));
  }

  // Filter by cuisine
  if (req.query.cuisine) {
    const cuisineFilter = req.query.cuisine.toLowerCase();
    result = result.filter(r => r.cuisine_type.toLowerCase().includes(cuisineFilter));
  }

  // Sort by rating
  if (req.query.sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  }

  res.json(result);
});

// GET /api/restaurants/:id
router.get('/:id', (req, res) => {
  const restaurant = restaurants.find(r => r.id === parseInt(req.params.id));
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }
  res.json(restaurant);
});

module.exports = router;
