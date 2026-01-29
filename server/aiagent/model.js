import OpenAI from "openai";
//使用模型的两种方案

//方案一 调用第三方模型api
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//方案二 自建模型服务器