     1	const express = require('express');
     2	const axios = require('axios');
     3	const cors = require('cors');
     4	
     5	const app = express();
     6	app.use(cors());
     7	app.use(express.json());
     8	
     9	const NAVER_CLIENT_ID = 'vvMjRTRRDIui74yDknsx';
    10	const NAVER_CLIENT_SECRET = 'KlUMVwzIuI';
    11	
    12	// Gemini API 키 (환경 변수 사용 권장)
    13	const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    14	
    15	// 헬스 체크
    16	app.get('/api/health', (req, res) => {
    17	    res.json({ 
    18	        status: 'ok', 
    19	        message: '서버가 정상 작동 중입니다.',
    20	        timestamp: new Date().toISOString(),
    21	        services: {
    22	            blog_search: 'ready',
    23	            ad_api: 'simulated',
    24	            gemini_api: GEMINI_API_KEY ? 'ready' : 'not_configured'
    25	        }
    26	    });
    27	});
    28	
    29	// 네이버 블로그 검색
    30	app.post('/api/naver-search', async (req, res) => {
    31	    const { query } = req.body;
    32	    console.log(`🔍 검색 요청: "${query}"`);
    33	    
    34	    try {
    35	        const response = await axios.get(
    36	            'https://openapi.naver.com/v1/search/blog.json',
    37	            {
    38	                params: { 
    39	                    query: query, 
    40	                    display: 100, 
    41	                    sort: 'sim' 
    42	                },
    43	                headers: {
    44	                    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    45	                    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    46	                }
    47	            }
    48	        );
    49	        
    50	        console.log(`✅ 검색 성공: ${response.data.items.length}개 결과`);
    51	        res.json(response.data);
    52	        
    53	    } catch (error) {
    54	        console.error('❌ 네이버 API 오류:', error.message);
    55	        res.status(500).json({ 
    56	            error: error.message,
    57	            details: error.response?.data 
    58	        });
    59	    }
    60	});
    61	
    62	// 광고 API (시뮬레이션)
    63	app.post('/api/naver-ad-rank', async (req, res) => {
    64	    const { keyword } = req.body;
    65	    console.log(`💰 광고 순위 조회: "${keyword}"`);
    66	    
    67	    const simulatedData = {
    68	        keyword: keyword,
    69	        naver: Math.random() > 0.2 ? Math.floor(Math.random() * 10) + 1 : null,
    70	        daum: Math.random() > 0.3 ? Math.floor(Math.random() * 10) + 1 : null,
    71	        google: Math.random() > 0.3 ? 'active' : (Math.random() > 0.5 ? 'paused' : 'inactive'),
    72	        status: 'simulated'
    73	    };
    74	    
    75	    res.json(simulatedData);
    76	});
    77	
    78	// Gemini API - 블로그 생성
    79	app.post('/api/generate-blog', async (req, res) => {
    80	    const { prompt } = req.body;
    81	    console.log(`✍️ 블로그 생성 요청 (Gemini)`);
    82	    
    83	    if (!GEMINI_API_KEY) {
    84	        return res.status(503).json({ 
    85	            error: 'Gemini API 키가 설정되지 않았습니다.',
    86	            message: '블로그 자동 생성 기능을 사용하려면 환경 변수 GEMINI_API_KEY를 설정하세요.'
    87	        });
    88	    }
    89	    
    90	    try {
    91	        const response = await axios.post(
    92	            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    93	            {
    94	                contents: [
    95	                    {
    96	                        parts: [
    97	                            { text: prompt }
    98	                        ]
    99	                    }
   100	                ]
   101	            },
   102	            {
   103	                headers: {
   104	                    'Content-Type': 'application/json'
   105	                }
   106	            }
   107	        );
   108	        
   109	        console.log(`✅ 블로그 생성 성공 (Gemini)`);
   110	        
   111	        // Gemini 응답 형식 변환
   112	        const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
   113	        
   114	        res.json({
   115	            content: [
   116	                {
   117	                    text: generatedText
   118	                }
   119	            ]
   120	        });
   121	        
   122	    } catch (error) {
   123	        console.error('❌ Gemini API 오류:', error.message);
   124	        res.status(500).json({ 
   125	            error: error.message,
   126	            details: error.response?.data 
   127	        });
   128	    }
   129	});
   130	
   131	const PORT = process.env.PORT || 3000;
   132	app.listen(PORT, () => {
   133	    console.log('');
   134	    console.log('🚀 네이버 API 서버 실행 중');
   135	    console.log(`📍 주소: http://localhost:${PORT}`);
   136	    console.log('✅ 준비 완료!');
   137	    console.log('');
   138	});
   139	
