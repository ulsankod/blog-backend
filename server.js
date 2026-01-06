const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS 설정 - 모든 도메인 허용
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const NAVER_CLIENT_ID = 'vvMjRTRRDIui74yDknsx';
const NAVER_CLIENT_SECRET = 'KlUMVwzIuI';

// Gemini API 키 (환경 변수 사용 권장)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 헬스 체크
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        services: {
            blog_search: 'ready',
            ad_api: 'simulated',
            gemini_api: GEMINI_API_KEY ? 'ready' : 'not_configured'
        }
    });
});

// 네이버 블로그 검색
app.post('/api/naver-search', async (req, res) => {
    const { query } = req.body;
    console.log(`🔍 검색 요청: "${query}"`);
    
    try {
        const response = await axios.get(
            'https://openapi.naver.com/v1/search/blog.json',
            {
                params: { 
                    query: query, 
                    display: 100, 
                    sort: 'sim' 
                },
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
        res.status(500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

// 광고 API (시뮬레이션)
app.post('/api/naver-ad-rank', async (req, res) => {
    const { keyword } = req.body;
    console.log(`💰 광고 순위 조회: "${keyword}"`);
    
    const simulatedData = {
        keyword: keyword,
        naver: Math.random() > 0.2 ? Math.floor(Math.random() * 10) + 1 : null,
        daum: Math.random() > 0.3 ? Math.floor(Math.random() * 10) + 1 : null,
        google: Math.random() > 0.3 ? 'active' : (Math.random() > 0.5 ? 'paused' : 'inactive'),
        status: 'simulated'
    };
    
    res.json(simulatedData);
});

// Gemini API - 블로그 생성
app.post('/api/generate-blog', async (req, res) => {
    const { prompt } = req.body;
    console.log(`✍️ 블로그 생성 요청 (Gemini)`);
    
    if (!GEMINI_API_KEY) {
        return res.status(503).json({ 
            error: 'Gemini API 키가 설정되지 않았습니다.',
            message: '블로그 자동 생성 기능을 사용하려면 환경 변수 GEMINI_API_KEY를 설정하세요.'
        });
    }
    
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`✅ 블로그 생성 성공 (Gemini)`);
        
        // Gemini 응답 형식 변환
        const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        res.json({
            content: [
                {
                    text: generatedText
                }
            ]
        });
        
    } catch (error) {
        console.error('❌ Gemini API 오류:', error.message);
        res.status(500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 네이버 API 서버 실행 중');
    console.log(`📍 주소: http://localhost:${PORT}`);
    console.log('✅ 준비 완료!');
    console.log('');
});
