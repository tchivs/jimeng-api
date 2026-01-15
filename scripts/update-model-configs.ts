#!/usr/bin/env node
/**
 * 手动更新模型配置脚本
 * 从官方 API 获取最新配置并保存到本地 JSON 文件
 *
 * 使用方法:
 *   npx tsx scripts/update-model-configs.ts
 *   或
 *   npm run update-configs
 */

import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 站点类型
type SiteType = "china" | "US" | "HK" | "JP" | "SG";

// 站点 API 配置
const SITE_API_CONFIGS: Record<SiteType, {
  name: string;
  // 国内站使用 agentConfigApiUrl 获取图片和视频模型（合并接口）
  // 国际站使用 imageConfigApiUrl 和 videoConfigApiUrl 分别获取
  agentConfigApiUrl?: string;
  imageConfigApiUrl?: string;
  videoConfigApiUrl?: string;
  appid: string;
  lan: string;
  loc: string;
}> = {
  china: {
    name: "即梦AI（国内站）",
    // 国内站使用 get_agent_config 接口，同时返回图片和视频模型
    agentConfigApiUrl: "https://jimeng.jianying.com/mweb/v1/creation_agent/v2/get_agent_config",
    appid: "513695",
    lan: "zh-Hans",
    loc: "cn",
  },
  US: {
    name: "Dreamina（美国站）",
    imageConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/get_common_config",
    videoConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/video_generate/get_common_config",
    appid: "513641",
    lan: "en",
    loc: "US",
  },
  HK: {
    name: "Dreamina（香港站）",
    imageConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/get_common_config",
    videoConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/video_generate/get_common_config",
    appid: "513641",
    lan: "en",
    loc: "HK",
  },
  JP: {
    name: "Dreamina（日本站）",
    imageConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/get_common_config",
    videoConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/video_generate/get_common_config",
    appid: "513641",
    lan: "en",
    loc: "JP",
  },
  SG: {
    name: "Dreamina（新加坡站）",
    imageConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/get_common_config",
    videoConfigApiUrl: "https://mweb-api-sg.capcut.com/mweb/v1/video_generate/get_common_config",
    appid: "513641",
    lan: "en",
    loc: "SG",
  },
};

// 配置文件路径
const CONFIG_FILE_PATH = path.join(__dirname, "../configs/model-configs.json");

interface ImageModelConfig {
  model_name: string;
  model_req_key: string;
  model_tip?: string;
  icon_url?: string;
  is_new_model?: boolean;
  feats?: string[];
  resolution_map?: Record<string, any>;
}

interface VideoModelConfig {
  model_name: string;
  model_req_key: string;
  model_tip?: string;
  icon?: {
    image_url?: string;
  };
  options?: Array<{
    key: string;
    value_type: string;
    enum_val?: {
      enum_type: string;
      string_value?: string[];
      int_value?: number[];
      default_val_idx: number;
    };
    slide_bar_val?: {
      min: number;
      max: number;
      step: number;
      default: number;
    };
    forbidden_display?: boolean;
  }>;
  extra?: Record<string, any>;
}

interface SiteConfigs {
  imageModels: ImageModelConfig[] | null;
  videoModels: VideoModelConfig[] | null;
}

interface StoredConfigs {
  china: SiteConfigs;
  US: SiteConfigs;
  HK: SiteConfigs;
  JP: SiteConfigs;
  SG: SiteConfigs;
  lastUpdated: string | null;
}

// 国内站：使用 get_agent_config 接口获取图片和视频模型
async function fetchChinaAgentConfig(): Promise<{ imageModels: ImageModelConfig[] | null; videoModels: VideoModelConfig[] | null }> {
  const siteApi = SITE_API_CONFIGS.china;

  const headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "appid": siteApi.appid,
    "appvr": "8.4.0",
    "lan": siteApi.lan,
    "loc": siteApi.loc,
    "pf": "7",
  };

  const queryParams = "?needCache=true&needRefresh=false&aid=513695&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync";

  const response = await axios.post(
    siteApi.agentConfigApiUrl + queryParams,
    {},
    { headers, timeout: 30000 }
  );

  const data = response.data;
  if (data.ret !== "0") {
    throw new Error(data.errmsg || "API 返回错误");
  }

  return {
    imageModels: data.data?.image_data?.model_list || null,
    videoModels: data.data?.video_data?.model_list || null,
  };
}

// 国际站：获取图片模型
async function fetchImageModels(site: SiteType): Promise<ImageModelConfig[] | null> {
  const siteApi = SITE_API_CONFIGS[site];
  if (!siteApi.imageConfigApiUrl) {
    throw new Error(`Site ${site} does not have imageConfigApiUrl`);
  }

  const headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "appid": siteApi.appid,
    "appvr": "8.4.0",
    "lan": siteApi.lan,
    "loc": siteApi.loc,
    "pf": "7",
  };

  const body = { is_client_filter: true, need_beta_model: true };
  const queryParams = "?needCache=true&needRefresh=false&aid=513641&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync";

  const response = await axios.post(
    siteApi.imageConfigApiUrl + queryParams,
    body,
    { headers, timeout: 30000 }
  );

  const data = response.data;
  if (data.ret !== "0") {
    throw new Error(data.errmsg || "API 返回错误");
  }

  return data.data?.model_list || null;
}

// 国际站：获取视频模型
async function fetchVideoModels(site: SiteType): Promise<VideoModelConfig[] | null> {
  const siteApi = SITE_API_CONFIGS[site];
  if (!siteApi.videoConfigApiUrl) {
    throw new Error(`Site ${site} does not have videoConfigApiUrl`);
  }

  const headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "appid": siteApi.appid,
    "appvr": "8.4.0",
    "lan": siteApi.lan,
    "loc": siteApi.loc,
    "pf": "7",
  };

  const queryParams = "?aid=513641&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync";

  const response = await axios.post(
    siteApi.videoConfigApiUrl + queryParams,
    { scene: "generate_video", params: {} },
    { headers, timeout: 30000 }
  );

  const data = response.data;
  if (data.ret !== "0") {
    throw new Error(data.errmsg || "API 返回错误");
  }

  return data.data?.model_list || null;
}

async function main() {
  console.log("========================================");
  console.log("  即梦 API 模型配置更新工具");
  console.log("========================================\n");

  const internationalSites: SiteType[] = ["US", "HK", "JP", "SG"];

  const stored: StoredConfigs = {
    china: { imageModels: null, videoModels: null },
    US: { imageModels: null, videoModels: null },
    HK: { imageModels: null, videoModels: null },
    JP: { imageModels: null, videoModels: null },
    SG: { imageModels: null, videoModels: null },
    lastUpdated: new Date().toISOString(),
  };

  let imageSuccessCount = 0;
  let imageFailCount = 0;
  let videoSuccessCount = 0;
  let videoFailCount = 0;

  // 获取国内站配置（使用 get_agent_config 接口，同时返回图片和视频模型）
  console.log("【国内站配置】");
  const chinaApi = SITE_API_CONFIGS.china;
  process.stdout.write(`正在获取 ${chinaApi.name} 配置（图片+视频）... `);

  try {
    const chinaConfig = await fetchChinaAgentConfig();
    if (chinaConfig.imageModels && chinaConfig.imageModels.length > 0) {
      stored.china.imageModels = chinaConfig.imageModels;
      imageSuccessCount++;
    }
    if (chinaConfig.videoModels && chinaConfig.videoModels.length > 0) {
      stored.china.videoModels = chinaConfig.videoModels;
      videoSuccessCount++;
    }
    const imageCount = chinaConfig.imageModels?.length || 0;
    const videoCount = chinaConfig.videoModels?.length || 0;
    console.log(`✓ 成功，图片模型: ${imageCount}, 视频模型: ${videoCount}`);
  } catch (error: any) {
    console.log(`✗ 失败: ${error.message}`);
    imageFailCount++;
    videoFailCount++;
  }

  // 获取国际站图片模型配置
  console.log("\n【国际站图片模型配置】");
  for (const site of internationalSites) {
    const siteApi = SITE_API_CONFIGS[site];
    process.stdout.write(`正在获取 ${siteApi.name} 配置... `);

    try {
      const modelList = await fetchImageModels(site);
      if (modelList && modelList.length > 0) {
        stored[site].imageModels = modelList;
        console.log(`✓ 成功，${modelList.length} 个模型`);
        imageSuccessCount++;
      } else {
        console.log(`✗ 返回数据为空`);
        imageFailCount++;
      }
    } catch (error: any) {
      console.log(`✗ 失败: ${error.message}`);
      imageFailCount++;
    }
  }

  // 获取国际站视频模型配置
  console.log("\n【国际站视频模型配置】");
  for (const site of internationalSites) {
    const siteApi = SITE_API_CONFIGS[site];
    process.stdout.write(`正在获取 ${siteApi.name} 配置... `);

    try {
      const modelList = await fetchVideoModels(site);
      if (modelList && modelList.length > 0) {
        stored[site].videoModels = modelList;
        console.log(`✓ 成功，${modelList.length} 个模型`);
        videoSuccessCount++;
      } else {
        console.log(`✗ 返回数据为空`);
        videoFailCount++;
      }
    } catch (error: any) {
      console.log(`✗ 失败: ${error.message}`);
      videoFailCount++;
    }
  }

  console.log("\n----------------------------------------");

  const totalSuccess = imageSuccessCount + videoSuccessCount;
  if (totalSuccess > 0) {
    // 确保目录存在
    await fs.ensureDir(path.dirname(CONFIG_FILE_PATH));

    // 保存配置
    await fs.writeJson(CONFIG_FILE_PATH, stored, { spaces: 2 });
    console.log(`配置已保存到: ${CONFIG_FILE_PATH}`);
    console.log(`更新时间: ${stored.lastUpdated}`);
  }

  console.log(`\n图片模型: ${imageSuccessCount} 成功, ${imageFailCount} 失败`);
  console.log(`视频模型: ${videoSuccessCount} 成功, ${videoFailCount} 失败`);
  console.log("========================================\n");

  // 显示模型摘要
  const allSites: SiteType[] = ["china", "US", "HK", "JP", "SG"];
  if (totalSuccess > 0) {
    console.log("模型摘要:");
    for (const site of allSites) {
      const siteConfig = stored[site];
      console.log(`\n[${SITE_API_CONFIGS[site].name}]`);

      // 图片模型
      if (siteConfig.imageModels && siteConfig.imageModels.length > 0) {
        console.log("  图片模型:");
        for (const model of siteConfig.imageModels) {
          const resolutions = model.resolution_map ? Object.keys(model.resolution_map).join(", ") : "无";
          console.log(`    - ${model.model_name} (${model.model_req_key})`);
          console.log(`      分辨率: ${resolutions}`);
        }
      }

      // 视频模型
      if (siteConfig.videoModels && siteConfig.videoModels.length > 0) {
        console.log("  视频模型:");
        for (const model of siteConfig.videoModels) {
          // 提取可用选项
          const optionKeys = model.options?.map(o => o.key).join(", ") || "无";
          console.log(`    - ${model.model_name} (${model.model_req_key})`);
          console.log(`      选项: ${optionKeys}`);
        }
      }
    }
  }

  const totalFail = imageFailCount + videoFailCount;
  process.exit(totalFail === allSites.length * 2 ? 1 : 0);
}

main().catch((error) => {
  console.error("执行出错:", error);
  process.exit(1);
});
