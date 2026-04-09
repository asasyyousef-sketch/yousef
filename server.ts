import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';
import cors from 'cors';
import cookieParser from 'cookie-parser';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Helper to get StatusNumber (ported from Python)
  const getStatusNumber = (status: string) => {
    status = status.trim();
    if (status === 'تم التسليم' || status.startsWith('تم المحاسبه') || status.startsWith('تم محاسبة')) {
      return '2';
    }
    if (status.includes('رفض') || status.includes('راجع مخزن') || status.includes('راجع عميل')) {
      return '4';
    }
    if (status === 'مؤجل' || status === 'اعادة ارسال') {
      return '3';
    }
    if (status.includes('واصل جزئي')) {
      return '#';
    }
    return '#';
  };

  // API Routes
  app.post('/api/hawk/process', async (req, res) => {
    const { username, password, filterKeyword, statusCode } = req.body;
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    try {
      // Login Hawk
      const loginRes = await client.post('https://msm-exp.com/login_db.php', 
        new URLSearchParams({ username, password }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!loginRes.data.toLowerCase().includes('logout')) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور لـ صقور نينوى خاطئة' });
      }

      // Fetch Hawk Orders
      const searchRes = await client.post('https://msm-exp.com/search_wasl.php',
        new URLSearchParams({ 'state[]': statusCode, 'wasl_search': '' }).toString(),
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        }
      );

      if (!searchRes.data || typeof searchRes.data !== 'string') {
        return res.status(500).json({ error: 'فشل في جلب البيانات من موقع صقور نينوى (استجابة فارغة)' });
      }

      const $ = cheerio.load(searchRes.data);
      const orders: any[] = [];
      
      const rows = $('tr[id]');
      if (rows.length === 0 && !searchRes.data.includes('table')) {
        // If no rows and no table found, maybe something is wrong with the page
        console.log('Hawk Search Response Sample:', searchRes.data.substring(0, 500));
      }

      rows.each((_, row) => {
        const cells = $(row).find('td');
        const text = $(row).text().trim();
        
        if (text.includes(filterKeyword)) {
          const checkbox = $(row).find('input[type="checkbox"][name="id[]"]');
          const value = checkbox.attr('value');
          const idWasl = $(row).find('td[style="color: #000;"]').eq(1).text().trim();
          const sequence = $(row).find('td[style="color: #000;"]').eq(0).text().trim();

          if (value && idWasl) {
            orders.push({ Sequence: sequence, idWasl_Value: idWasl, Value: value });
          }
        }
      });

      res.json({ orders, message: `تم جلب وتصفية ${orders.length} طلب` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/jood/process', async (req, res) => {
    const { username, password, dates } = req.body;
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    try {
      // Login Jood
      const loginRes = await client.post('https://aljoodexp.com/login_db.php',
        new URLSearchParams({ username, password }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!loginRes.data.includes('logout.php')) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور لشركة الجود خاطئة' });
      }

      const allOrders: any[] = [];
      const headers = [
        'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
        'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
        'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
        'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
      ];

      for (const date of dates) {
        const searchRes = await client.post('https://aljoodexp.com/search_wasl2.php',
          new URLSearchParams({ 'date_add': date, 'wasl_search': 'بحث' }).toString(),
          { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        if (!searchRes.data || typeof searchRes.data !== 'string') {
          continue; // Skip this date if failed
        }

        const $ = cheerio.load(searchRes.data);
        $('tr[id]').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 21) {
            const rowData: any = { Value: $(row).attr('id') };
            for (let i = 1; i <= 20; i++) {
              const headerName = headers[i];
              let cellText = $(cells[i]).text().trim();
              const link = $(cells[i]).find('a');
              if (link.length > 0) {
                cellText = link.text().trim();
              }
              rowData[headerName] = cellText;
            }
            allOrders.push(rowData);
          }
        });
      }

      res.json({ orders: allOrders, message: `اكتمل جلب طلبات الجود. الإجمالي: ${allOrders.length}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/update-server', async (req, res) => {
    const { username, password, urls } = req.body;
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    try {
      // Login Hawk for updates
      const loginRes = await client.post('https://msm-exp.com/login_db.php', 
        new URLSearchParams({ username, password }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!loginRes.data.toLowerCase().includes('logout')) {
        return res.status(401).json({ error: 'فشل تسجيل الدخول للسيرفر لتنفيذ التحديثات' });
      }

      let successCount = 0;
      for (const url of urls) {
        try {
          await client.get(url, { timeout: 10000 });
          successCount++;
        } catch (e) {
          console.error(`Failed to update URL: ${url}`);
        }
      }

      res.json({ message: `تم إرسال ${successCount} رابط تحديث بنجاح`, successCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
