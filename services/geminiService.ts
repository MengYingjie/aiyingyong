
import { GoogleGenAI, Type } from "@google/genai";
import { AuditResult, Difference } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const analyzeUIComparison = async (
  designBase64: string,
  implementationBase64: string
): Promise<AuditResult> => {
  const model = "gemini-3-flash-preview";

  const prompt = `
    你是一位资深的专业 UI 设计师。请对比【设计稿】与【实装图】，根据以下专业走查规范输出审计报告：

    ---
    【任务目标】
    1. 找出实现图与设计稿之间的所有视觉不一致项。
    2. 为每个不一致项在【实现图】上标注一个精准的坐标点 (x, y)，x 和 y 为 0-100 之间的百分比数值。
    3. 识别截图平台（iOS/Android/Dual）。

    ---
    【平台识别任务】
    请观察图片中的状态栏、系统导航条、系统字体等特征。
    - 如果明显是 iPhone 特征，platform 设为 "ios"。
    - 如果明显是 Android 特征，platform 设为 "android"。
    - 否则设为 "dual"。

    ---
    【问题优先级规范】
    - P0: 阻塞级。组件重叠、硬编码样式、核心功能不可用。
    - P1: 高优先级。关键间距、品牌色、核心布局严重偏差。
    - P2: 中优先级。1-2px 像素偏差、对齐问题、行高不规范。
    - P3: 低优先级。极端场景、细微建议。

    输出格式：JSON，必须包含 summary, matchScore, 以及 differences 数组。
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: designBase64 } },
        { inlineData: { mimeType: "image/png", data: implementationBase64 } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          matchScore: { type: Type.INTEGER },
          differences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, enum: ['color', 'spacing', 'typography', 'layout', 'border-radius', 'size', 'other'] },
                description: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['P0', 'P1', 'P2', 'P3'] },
                suggestion: { type: Type.STRING },
                platform: { type: Type.STRING, enum: ['dual', 'ios', 'android'] },
                coordinates: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                  },
                  required: ["x", "y"]
                }
              },
              required: ["category", "description", "severity", "platform", "coordinates"]
            }
          }
        },
        required: ["summary", "matchScore", "differences"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("AI 返回内容为空");
    const result = JSON.parse(text);
    result.differences = result.differences.map((d: any) => ({
      ...d,
      status: 'pending'
    }));
    return result;
  } catch (error) {
    console.error("Gemini 解析错误:", error);
    throw new Error("走查报告解析失败。");
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
