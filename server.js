const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ============ CORS 설정 ============
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ============ API 키 설정 ============
const NAVER_CLIENT_ID = 'vvMjRTRRDIui74yDknsx';
const NAVER_CLIENT_SECRET = 'KlUMVwzIuI';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ============ MongoDB 연결 설정 ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:KBoMSfiusoYJOefgXuhCQCbAKnazqLDu@mongodb.railway.internal:27017';

console.log('');
console.log('✅ MongoDB URI 설정됨');
console.log('📍 연결 주소:', MONGODB_URI.substring(0, 30) + '...');
console.log('');

// MongoDB 연결
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB 연결 성공');
    console.log('');
})
.catch(err => {
    console.error('❌ MongoDB 연결 실패:', err.message);
    console.error('');
    process.exit(1);
});

// ============ MongoDB 스키마 정의 ============

// 키워드 스키마
const keywordSchema = new mongoose.Schema({
    brand: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    category: { type: String, required: true },
    keyword: { type: String, required: true },
    corporateRank: { type: Number, default: null },
    turtleRank: { type: Number, default: null }
}, {
    timestamps: true
});

// 복합 유니크 인덱스: 같은 브랜드/타입/카테고리/키워드는 중복 불가
keywordSchema.index({ brand: 1, type: 1, category: 1, keyword: 1 }, { unique: true });

const Keyword = mongoose.model('Keyword', keywordSchema);

// AI 데이터 스키마
const aiDataSchema = new mongoose.Schema({
    brand: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    category: { type: String, required: true },
    keyword: { type: String, required: true },
    corporateRank: { type: Number, default: null },
    turtleRank: { type: Number, default: null },
    collectedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const AIData = mongoose.model('AIData', aiDataSchema);

// 블로그 계정 스키마
const blogAccountSchema = new mongoose.Schema({
    brand: { type: String, required: true, index: true },
    accountType: { type: String, required: true, enum: ['corporate', 'turtle'] },
    blogUrl: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

blogAccountSchema.index({ brand: 1, accountType: 1 }, { unique: true });

const BlogAccount = mongoose.model('BlogAccount', blogAccountSchema);

// Settings 스키마
const settingsSchema = new mongoose.Schema({
    brand: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    settingKey: { type: String, required: true },
    settingValue: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

settingsSchema.index({ brand: 1, type: 1, settingKey: 1 }, { unique: true });

const Settings = mongoose.model('Settings', settingsSchema);

// ============ 헬스 체크 ============
app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    
    try {
        // MongoDB 연결 상태 확인
        if (mongoose.connection.readyState === 1) {
            dbStatus = 'connected';
        }
    } catch (err) {
        dbStatus = 'error';
    }
    
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus,
            blog_search: 'ready',
            ad_api: 'simulated',
            gemini_api: GEMINI_API_KEY ? 'ready' : 'not_configured'
        }
    });
});

// ============ 키워드 관리 API ============

// 키워드 조회
app.get('/api/keywords/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const keywords = await Keyword.find({ brand, type })
            .sort({ category: 1, keyword: 1 });
        
        console.log(`✅ 키워드 조회: ${brand}/${type} - ${keywords.length}개`);
        res.json(keywords);
    } catch (error) {
        console.error('❌ 키워드 조회 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 키워드 추가
app.post('/api/keywords', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', category, keyword } = req.body;
        
        // upsert: 없으면 생성, 있으면 업데이트
        const result = await Keyword.findOneAndUpdate(
            { brand, type, category, keyword },
            { brand, type, category, keyword },
            { upsert: true, new: true }
        );
        
        console.log(`✅ 키워드 추가: ${category} - ${keyword}`);
        res.json(result);
    } catch (error) {
        console.error('❌ 키워드 추가 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 순위 업데이트
app.put('/api/keywords/:brand/:type/update', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const { category, keyword, field, value } = req.body;
        
        const updateField = field === 'corporate' ? 'corporateRank' : 'turtleRank';
        
        const result = await Keyword.findOneAndUpdate(
            { brand, type, category, keyword },
            { [updateField]: value },
            { new: true }
        );
        
        if (!result) {
            return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
        }
        
        console.log(`✅ 순위 업데이트: ${category} - ${keyword} → ${field}: ${value}`);
        res.json(result);
    } catch (error) {
        console.error('❌ 순위 업데이트 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 키워드 삭제
app.delete('/api/keywords/:brand/:type/:category/:keyword', async (req, res) => {
    try {
        const { brand, type, category, keyword } = req.params;
        
        const result = await Keyword.deleteOne({ brand, type, category, keyword });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
        }
        
        console.log(`✅ 키워드 삭제: ${category} - ${keyword}`);
        res.json({ success: true, message: '키워드가 삭제되었습니다' });
    } catch (error) {
        console.error('❌ 키워드 삭제 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 키워드 일괄 업로드
app.post('/api/keywords/bulk', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', keywords } = req.body;
        
        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ error: '키워드 배열이 필요합니다' });
        }
        
        const operations = keywords.map(item => ({
            updateOne: {
                filter: { brand, type, category: item.category, keyword: item.keyword },
                update: { 
                    brand, 
                    type, 
                    category: item.category, 
                    keyword: item.keyword,
                    corporateRank: item.corporateRank || null,
                    turtleRank: item.turtleRank || null
                },
                upsert: true
            }
        }));
        
        const result = await Keyword.bulkWrite(operations);
        
        console.log(`✅ 키워드 일괄 업로드: ${keywords.length}개 (추가: ${result.upsertedCount}, 수정: ${result.modifiedCount})`);
        
        res.json({ 
            success: true,
            inserted: result.upsertedCount,
            updated: result.modifiedCount,
            total: keywords.length
        });
    } catch (error) {
        console.error('❌ 키워드 일괄 업로드 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ AI 데이터 관리 API ============

// AI 데이터 저장
app.post('/api/ai-data', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', data } = req.body;
        
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'AI 데이터 배열이 필요합니다' });
        }
        
        // 기존 AI 데이터 삭제
        await AIData.deleteMany({ brand, type });
        
        // 새 데이터 삽입
        const aiRecords = data.map(item => ({
            brand,
            type,
            category: item.category,
            keyword: item.keyword,
            corporateRank: item.corporateRank || null,
            turtleRank: item.turtleRank || null,
            collectedAt: new Date()
        }));
        
        await AIData.insertMany(aiRecords);
        
        console.log(`✅ AI 데이터 저장: ${brand}/${type} - ${data.length}개`);
        
        res.json({ 
            success: true, 
            count: data.length 
        });
    } catch (error) {
        console.error('❌ AI 데이터 저장 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// AI 데이터 조회
app.get('/api/ai-data/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const aiData = await AIData.find({ brand, type })
            .sort({ category: 1, keyword: 1 });
        
        console.log(`✅ AI 데이터 조회: ${brand}/${type} - ${aiData.length}개`);
        res.json(aiData);
    } catch (error) {
        console.error('❌ AI 데이터 조회 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 블로그 계정 관리 API ============

// 블로그 계정 저장
app.post('/api/blog-accounts', async (req, res) => {
    try {
        const { brand = 'jenfix', corporate, turtle } = req.body;
        
        const updates = [];
        
        if (corporate) {
            updates.push(
                BlogAccount.findOneAndUpdate(
                    { brand, accountType: 'corporate' },
                    { brand, accountType: 'corporate', blogUrl: corporate, updatedAt: new Date() },
                    { upsert: true, new: true }
                )
            );
        }
        
        if (turtle) {
            updates.push(
                BlogAccount.findOneAndUpdate(
                    { brand, accountType: 'turtle' },
                    { brand, accountType: 'turtle', blogUrl: turtle, updatedAt: new Date() },
                    { upsert: true, new: true }
                )
            );
        }
        
        await Promise.all(updates);
        
        console.log(`✅ 블로그 계정 저장: ${brand}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ 블로그 계정 저장 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 블로그 계정 조회
app.get('/api/blog-accounts/:brand', async (req, res) => {
    try {
        const { brand } = req.params;
        const accounts = await BlogAccount.find({ brand });
        
        const result = {};
        accounts.forEach(acc => {
            result[acc.accountType] = acc.blogUrl;
        });
        
        console.log(`✅ 블로그 계정 조회: ${brand}`);
        res.json(result);
    } catch (error) {
        console.error('❌ 블로그 계정 조회 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 마이그레이션 API ============

app.post('/api/migrate', async (req, res) => {
    try {
        const { keywords, finalData, accounts } = req.body;
        
        let insertedCount = 0;
        
        // 키워드 마이그레이션
        if (finalData && finalData.jenfix && finalData.jenfix.blog) {
            const blogKeywords = finalData.jenfix.blog;
            
            const operations = blogKeywords.map(item => ({
                updateOne: {
                    filter: { 
                        brand: 'jenfix', 
                        type: 'blog', 
                        category: item.category, 
                        keyword: item.keyword 
                    },
                    update: { 
                        brand: 'jenfix',
                        type: 'blog',
                        category: item.category,
                        keyword: item.keyword,
                        corporateRank: item.corporateRank || null,
                        turtleRank: item.turtleRank || null
                    },
                    upsert: true
                }
            }));
            
            const result = await Keyword.bulkWrite(operations);
            insertedCount = result.upsertedCount + result.modifiedCount;
        }
        
        // 블로그 계정 마이그레이션
        if (accounts && accounts.jenfix) {
            const { corporate, turtle } = accounts.jenfix;
            
            if (corporate) {
                await BlogAccount.findOneAndUpdate(
                    { brand: 'jenfix', accountType: 'corporate' },
                    { brand: 'jenfix', accountType: 'corporate', blogUrl: corporate, updatedAt: new Date() },
                    { upsert: true }
                );
            }
            
            if (turtle) {
                await BlogAccount.findOneAndUpdate(
                    { brand: 'jenfix', accountType: 'turtle' },
                    { brand: 'jenfix', accountType: 'turtle', blogUrl: turtle, updatedAt: new Date() },
                    { upsert: true }
                );
            }
        }
        
        console.log(`✅ 마이그레이션 완료: ${insertedCount}개 키워드`);
        
        res.json({ 
            success: true, 
            keywordsImported: insertedCount,
            message: '마이그레이션이 완료되었습니다'
        });
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 전체 데이터 동기화 API ============

app.get('/api/sync/all/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        
        // 키워드, AI 데이터, 블로그 계정 모두 조회
        const [keywords, aiData, accounts] = await Promise.all([
            Keyword.find({ brand, type }).sort({ category: 1, keyword: 1 }),
            AIData.find({ brand, type }).sort({ category: 1, keyword: 1 }),
            BlogAccount.find({ brand })
        ]);
        
        const accountsObj = {};
        accounts.forEach(acc => {
            accountsObj[acc.accountType] = acc.blogUrl;
        });
        
        console.log(`✅ 전체 동기화: ${brand}/${type} - ${keywords.length}개 키워드`);
        
        res.json({
            keywords,
            aiData,
            accounts: accountsObj
        });
    } catch (error) {
        console.error('❌ 전체 동기화 오류:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 네이버 검색 API ============

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

// ============ 광고 순위 시뮬레이션 API ============

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

// ============ Gemini API - 블로그 생성 ============

app.post('/api/generate-blog', async (req, res) => {
    const { prompt } = req.body;
    console.log(`✍️ 블로그 생성 요청 (Gemini)`);
    
    if (!GEMINI_API_KEY) {
        return res.status(503).json({ 
            error: 'Gemini API 키가 설정되지 않았습니다.'
        });
    }
    
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash-001',
        'gemini-2.5-flash-lite'
    ];
    
    let lastError = null;
    
    for (const modelName of modelsToTry) {
        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await axios.post(
                apiUrl,
                {
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ]
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }
            );
            
            const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            console.log(`✅ 블로그 생성 성공 (${modelName})`);
            
            return res.json({
                content: [{ text: generatedText }],
                model: modelName
            });
            
        } catch (error) {
            console.log(`❌ ${modelName} 실패: ${error.message}`);
            lastError = error;
            
            if (error.response?.status !== 404) {
                break;
            }
            continue;
        }
    }
    
    console.error('❌ 모든 Gemini 모델 시도 실패');
    
    res.status(500).json({ 
        error: lastError?.message || 'Gemini API 호출 실패',
        triedModels: modelsToTry
    });
});

// ============ 서버 시작 ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 블로그 & 키워드광고 통합 관리 시스템 백엔드 서버 실행 중');
    console.log(`📍 주소: http://localhost:${PORT}`);
    console.log(`📊 상태: http://localhost:${PORT}/api/health`);
    console.log('✅ 준비 완료!');
    console.log('');
});
