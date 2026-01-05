const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const NAVER_CLIENT_ID = 'vvMjRTRRDIui74yDknsx';
const NAVER_CLIENT_SECRET = 'KlUMVwzIuI';

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        services: {
            blog_search: 'ready',
            ad_api: 'simulated'
        }
    });
});

app.post('/api/naver-search', async (req, res) => {
    const { query } = req.body;
    console.log(`🔍 검색 요청: "${query}"`);
    
    try {
        const response = await axios.get(
            'https://openapi.naver.com/v1/search/blog.json',
            {
                params: { query: query, display: 100, sort: 'sim' },
                headers: {
                    'X-Naver-Client-Id': NAVER_CLIENT_ID,
                    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
                }
            }
        );
        
        console.log(`✅ 검색 성공: ${response.data.items.length}개 결과`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ 네이버 API 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 서버 실행 중: http://localhost:' + PORT);
});
