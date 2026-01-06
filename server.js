const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

const NAVER_CLIENT_ID = 'vvMjRTRRDIui74yDknsx';
const NAVER_CLIENT_SECRET = 'KlUMVwzIuI';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jenfix_blog_system';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB 연결 성공'))
.catch(err => console.error('❌ MongoDB 연결 실패:', err));

const KeywordSchema = new mongoose.Schema({
    brand: { type: String, required: true, default: 'jenfix' },
    type: { type: String, required: true, default: 'blog' },
    category: { type: String, required: true },
    keyword: { type: String, required: true },
    corporateRank: { type: Number, default: null },
    turtleRank: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

KeywordSchema.index({ brand: 1, type: 1, category: 1, keyword: 1 }, { unique: true });

const AIDataSchema = new mongoose.Schema({
    brand: { type: String, required: true, default: 'jenfix' },
    type: { type: String, required: true, default: 'blog' },
    category: { type: String, required: true },
    keyword: { type: String, required: true },
    corporateRank: { type: Number, default: null },
    turtleRank: { type: Number, default: null },
    collectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const BlogAccountSchema = new mongoose.Schema({
    brand: { type: String, required: true, default: 'jenfix' },
    accountType: { type: String, required: true },
    blogUrl: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

BlogAccountSchema.index({ brand: 1, accountType: 1 }, { unique: true });

const Keyword = mongoose.model('Keyword', KeywordSchema);
const AIData = mongoose.model('AIData', AIDataSchema);
const BlogAccount = mongoose.model('BlogAccount', BlogAccountSchema);

app.get('/api/health', async (req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
        status: 'ok', 
        message: '서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        services: {
            blog_search: 'ready',
            ad_api: 'simulated',
            gemini_api: GEMINI_API_KEY ? 'ready' : 'not_configured',
            database: mongoStatus
        }
    });
});

app.get('/api/keywords/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const keywords = await Keyword.find({ brand, type }).sort({ category: 1, keyword: 1 });
        console.log(`✅ 키워드 조회: ${brand}/${type} - ${keywords.length}개`);
        res.json({ success: true, data: keywords });
    } catch (error) {
        console.error('❌ 키워드 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/keywords', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', category, keyword } = req.body;
        if (!category || !keyword) {
            return res.status(400).json({ success: false, error: '카테고리와 키워드는 필수입니다' });
        }
        const newKeyword = await Keyword.findOneAndUpdate(
            { brand, type, category, keyword },
            { brand, type, category, keyword, updatedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`✅ 키워드 추가: ${keyword} (${category})`);
        res.json({ success: true, data: newKeyword });
    } catch (error) {
        console.error('❌ 키워드 추가 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/keywords/:brand/:type/update', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const { category, keyword, corporateRank, turtleRank } = req.body;
        const updated = await Keyword.findOneAndUpdate(
            { brand, type, category, keyword },
            { 
                corporateRank: corporateRank !== undefined ? corporateRank : null,
                turtleRank: turtleRank !== undefined ? turtleRank : null,
                updatedAt: new Date()
            },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, error: '키워드를 찾을 수 없습니다' });
        }
        console.log(`✅ 순위 업데이트: ${keyword} - corporate: ${corporateRank}, turtle: ${turtleRank}`);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('❌ 순위 업데이트 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/keywords/:brand/:type/:category/:keyword', async (req, res) => {
    try {
        const { brand, type, category, keyword } = req.params;
        const deleted = await Keyword.findOneAndDelete({ brand, type, category, keyword });
        if (!deleted) {
            return res.status(404).json({ success: false, error: '키워드를 찾을 수 없습니다' });
        }
        console.log(`🗑️ 키워드 삭제: ${keyword} (${category})`);
        res.json({ success: true, message: '키워드가 삭제되었습니다' });
    } catch (error) {
        console.error('❌ 키워드 삭제 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/keywords/bulk', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', keywords } = req.body;
        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ success: false, error: '키워드 배열이 필요합니다' });
        }
        let added = 0;
        let skipped = 0;
        for (const kw of keywords) {
            const { category, keyword } = kw;
            if (!category || !keyword) {
                skipped++;
                continue;
            }
            const existing = await Keyword.findOne({ brand, type, category, keyword });
            if (existing) {
                skipped++;
            } else {
                await Keyword.create({ brand, type, category, keyword });
                added++;
            }
        }
        console.log(`✅ 일괄 업로드: ${added}개 추가, ${skipped}개 중복`);
        res.json({ success: true, added, skipped, message: `${added}개 추가됨, ${skipped}개 중복` });
    } catch (error) {
        console.error('❌ 일괄 업로드 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ai-data', async (req, res) => {
    try {
        const { brand = 'jenfix', type = 'blog', category, keyword, corporateRank, turtleRank } = req.body;
        const aiData = await AIData.create({ brand, type, category, keyword, corporateRank, turtleRank, collectedAt: new Date() });
        console.log(`✅ AI 데이터 저장: ${keyword}`);
        res.json({ success: true, data: aiData });
    } catch (error) {
        console.error('❌ AI 데이터 저장 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ai-data/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const aiData = await AIData.find({ brand, type }).sort({ collectedAt: -1 });
        console.log(`✅ AI 데이터 조회: ${brand}/${type} - ${aiData.length}개`);
        res.json({ success: true, data: aiData });
    } catch (error) {
        console.error('❌ AI 데이터 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/blog-accounts', async (req, res) => {
    try {
        const { brand = 'jenfix', accounts } = req.body;
        if (!accounts || !accounts.corporate || !accounts.turtle) {
            return res.status(400).json({ success: false, error: '법인 블로그와 거북이 블로그 URL이 필요합니다' });
        }
        await BlogAccount.findOneAndUpdate(
            { brand, accountType: 'corporate' },
            { brand, accountType: 'corporate', blogUrl: accounts.corporate, updatedAt: new Date() },
            { upsert: true }
        );
        await BlogAccount.findOneAndUpdate(
            { brand, accountType: 'turtle' },
            { brand, accountType: 'turtle', blogUrl: accounts.turtle, updatedAt: new Date() },
            { upsert: true }
        );
        console.log(`✅ 블로그 계정 저장`);
        res.json({ success: true, message: '블로그 계정이 저장되었습니다' });
    } catch (error) {
        console.error('❌ 블로그 계정 저장 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/blog-accounts/:brand', async (req, res) => {
    try {
        const { brand } = req.params;
        const accounts = await BlogAccount.find({ brand });
        const result = {};
        accounts.forEach(acc => { result[acc.accountType] = acc.blogUrl; });
        console.log(`✅ 블로그 계정 조회`);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('❌ 블로그 계정 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/migrate', async (req, res) => {
    try {
        const { keywords, finalData, accounts } = req.body;
        let migratedKeywords = 0;
        let migratedAccounts = 0;
        if (keywords?.jenfix?.blog) {
            for (const kw of keywords.jenfix.blog) {
                await Keyword.findOneAndUpdate(
                    { brand: 'jenfix', type: 'blog', category: kw.category, keyword: kw.keyword },
                    { brand: 'jenfix', type: 'blog', category: kw.category, keyword: kw.keyword, corporateRank: kw.corporateRank || null, turtleRank: kw.turtleRank || null },
                    { upsert: true }
                );
                migratedKeywords++;
            }
        }
        if (finalData?.jenfix?.blog) {
            for (const kw of finalData.jenfix.blog) {
                await Keyword.findOneAndUpdate(
                    { brand: 'jenfix', type: 'blog', category: kw.category, keyword: kw.keyword },
                    { corporateRank: kw.corporateRank || null, turtleRank: kw.turtleRank || null, updatedAt: new Date() }
                );
            }
        }
        if (accounts?.jenfix?.blog) {
            if (accounts.jenfix.blog.corporate) {
                await BlogAccount.findOneAndUpdate(
                    { brand: 'jenfix', accountType: 'corporate' },
                    { brand: 'jenfix', accountType: 'corporate', blogUrl: accounts.jenfix.blog.corporate },
                    { upsert: true }
                );
                migratedAccounts++;
            }
            if (accounts.jenfix.blog.turtle) {
                await BlogAccount.findOneAndUpdate(
                    { brand: 'jenfix', accountType: 'turtle' },
                    { brand: 'jenfix', accountType: 'turtle', blogUrl: accounts.jenfix.blog.turtle },
                    { upsert: true }
                );
                migratedAccounts++;
            }
        }
        console.log(`✅ 마이그레이션 완료: 키워드 ${migratedKeywords}개, 계정 ${migratedAccounts}개`);
        res.json({ success: true, migrated: { keywords: migratedKeywords, settings: 0, accounts: migratedAccounts } });
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/sync/all/:brand/:type', async (req, res) => {
    try {
        const { brand, type } = req.params;
        const keywords = await Keyword.find({ brand, type }).sort({ category: 1, keyword: 1 });
        const aiData = await AIData.find({ brand, type }).sort({ collectedAt: -1 }).limit(100);
        const blogAccounts = await BlogAccount.find({ brand });
        const accounts = {};
        blogAccounts.forEach(acc => { accounts[acc.accountType] = acc.blogUrl; });
        console.log(`✅ 전체 데이터 동기화: ${brand}/${type}`);
        res.json({ success: true, data: { keywords, aiData, accounts } });
    } catch (error) {
        console.error('❌ 동기화 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/naver-search', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: '검색어(query)가 필요합니다' });
    }
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
            params: { query: query, display: 100, sort: 'sim' },
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
        });
        console.log(`✅ 네이버 검색: "${query}" - ${response.data.items.length}건`);
        res.json(response.data);
    } catch (error) {
        console.error('❌ 네이버 검색 API 오류:', error.message);
        res.status(500).json({ error: '네이버 API 호출 실패', details: error.message });
    }
});

app.post('/api/naver-ad-rank', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
        return res.status(400).json({ error: '키워드가 필요합니다' });
    }
    const mockRank = {
        naver: Math.floor(Math.random() * 10) + 1,
        daum: Math.floor(Math.random() * 10) + 1,
        google: Math.random() > 0.5 ? 'active' : 'inactive'
    };
    console.log(`✅ 광고 순위 조회 (시뮬레이션): "${keyword}"`);
    res.json(mockRank);
});

app.post('/api/generate-blog', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
    }
    const { keyword, tone = 'informative', targetAudience = '일반 독자' } = req.body;
    if (!keyword) {
        return res.status(400).json({ error: '키워드가 필요합니다' });
    }
    try {
        const prompt = `다음 키워드에 대한 블로그 글을 작성해주세요:\n\n키워드: ${keyword}\n톤: ${tone}\n대상 독자: ${targetAudience}\n\n요구사항:\n- 제목: 클릭을 유도하는 매력적인 제목\n- 본문: 1000-1500자, 정보성과 가독성을 갖춘 내용\n- 구조: 서론-본론-결론\n- SEO: 키워드 자연스럽게 포함\n\nJSON 형식으로 응답해주세요:\n{\n  "title": "블로그 제목",\n  "content": "본문 내용",\n  "tags": ["태그1", "태그2", "태그3"]\n}`;
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );
        const generatedText = response.data.candidates[0].content.parts[0].text;
        let blogPost;
        try {
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                blogPost = JSON.parse(jsonMatch[0]);
            } else {
                blogPost = { title: `${keyword}에 대한 완벽 가이드`, content: generatedText, tags: [keyword] };
            }
        } catch (parseError) {
            blogPost = { title: `${keyword}에 대한 완벽 가이드`, content: generatedText, tags: [keyword] };
        }
        console.log(`✅ 블로그 글 생성: "${keyword}"`);
        res.json(blogPost);
    } catch (error) {
        console.error('❌ Gemini API 오류:', error.response?.data || error.message);
        res.status(500).json({ error: 'Gemini API 호출 실패', details: error.response?.data || error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
    console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api`);
    console.log(`🔗 헬스 체크: http://localhost:${PORT}/api/health`);
    console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? '연결됨' : '연결 대기 중...'}`);
});
