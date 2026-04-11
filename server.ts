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

const hawkSessionCache = new Map<string, { jar: CookieJar, lastUsed: number }>();
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

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

  app.post('/api/source/process', async (req, res) => {
    const { username, password, dates, source } = req.body;
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));

    const sources = {
      jood: {
        loginUrl: 'https://aljoodexp.com/login_db.php',
        searchUrl: 'https://aljoodexp.com/search_wasl2.php',
        loginCheck: 'logout.php',
        sourceName: 'شركة الجود'
      },
      shaya: {
        loginUrl: 'https://alshaayie2-exp.com/login_db.php',
        searchUrl: 'https://alshaayie2-exp.com/search_wasl2.php',
        loginCheck: 'logout.php',
        sourceName: 'شركة الشائع'
      }
    };

    const config = sources[source as 'jood' | 'shaya'] || sources.jood;

    try {
      // Login
      const loginRes = await client.post(config.loginUrl,
        new URLSearchParams({ username, password }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!loginRes.data.includes(config.loginCheck)) {
        return res.status(401).json({ error: `اسم المستخدم أو كلمة المرور لـ ${config.sourceName} خاطئة` });
      }

      const allOrders: any[] = [];
      const headers = [
        'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
        'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
        'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
        'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
      ];

      for (const date of dates) {
        const searchRes = await client.post(config.searchUrl,
          new URLSearchParams({ 'date_add': date, 'wasl_search': 'بحث' }).toString(),
          { 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        if (!searchRes.data || typeof searchRes.data !== 'string') {
          continue;
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

      res.json({ orders: allOrders, message: `اكتمل جلب طلبات ${config.sourceName}. الإجمالي: ${allOrders.length}` });
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
    
    let jar: CookieJar;
    const cached = hawkSessionCache.get(username);
    const now = Date.now();

    if (cached && (now - cached.lastUsed < SESSION_TIMEOUT)) {
      jar = cached.jar;
      cached.lastUsed = now;
    } else {
      jar = new CookieJar();
      const client = wrapper(axios.create({ jar, withCredentials: true }));
      try {
        const loginRes = await client.post('https://msm-exp.com/login_db.php', 
          new URLSearchParams({ username, password }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        if (!loginRes.data.toLowerCase().includes('logout')) {
          return res.status(401).json({ error: 'فشل تسجيل الدخول للسيرفر لتنفيذ التحديثات' });
        }
        hawkSessionCache.set(username, { jar, lastUsed: now });
      } catch (error: any) {
        return res.status(500).json({ error: `فشل تسجيل الدخول: ${error.message}` });
      }
    }

    const client = wrapper(axios.create({ jar, withCredentials: true }));

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      let successCount = 0;
      let failCount = 0;

      // Process in batches of 10 for speed but to avoid overwhelming the target server
      const batchSize = 10;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (url) => {
          try {
            await client.get(url, { timeout: 15000 });
            return { url, success: true };
          } catch (e: any) {
            return { url, success: false, error: e.message };
          }
        }));

        for (const resItem of results) {
          if (resItem.success) successCount++;
          else failCount++;
          res.write(JSON.stringify(resItem) + '\n');
        }
      }

      res.write(JSON.stringify({ summary: true, successCount, failCount }) + '\n');
      res.end();
    } catch (error: any) {
      res.write(JSON.stringify({ error: error.message }) + '\n');
      res.end();
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
