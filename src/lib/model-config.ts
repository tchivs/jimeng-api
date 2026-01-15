/**
 * 模型配置服务
 * 从本地 JSON 文件加载配置，支持手动刷新从官方 API 获取最新配置
 */
import axios from "axios";
import fs from "fs-extra";
import path from "path";
import logger from "./logger.js";

// 站点类型
export type SiteType = "china" | "US" | "HK" | "JP" | "SG";

// 站点 API 配置
const SITE_API_CONFIGS: Record<SiteType, {
  name: string;
  imageConfigApiUrl: string;
  videoConfigApiUrl: string;
  appid: string;
  lan: string;
  loc: string;
}> = {
  china: {
    name: "即梦AI（国内站）",
    imageConfigApiUrl: "https://jimeng.jianying.com/mweb/v1/get_common_config",
    videoConfigApiUrl: "https://jimeng.jianying.com/mweb/v1/video_generate/get_common_config",
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

// ratio_type 到比例字符串的映射
const RATIO_TYPE_MAP: Record<number, string> = {
  1: "1:1",
  2: "3:4",
  3: "16:9",
  4: "4:3",
  5: "9:16",
  6: "2:3",
  7: "3:2",
  8: "21:9",
};

// 比例字符串到 ratio_type 的映射
const RATIO_STRING_MAP: Record<string, number> = {
  "1:1": 1,
  "3:4": 2,
  "16:9": 3,
  "4:3": 4,
  "9:16": 5,
  "2:3": 6,
  "3:2": 7,
  "21:9": 8,
};

// model_req_key 到简化 ID 的映射
const MODEL_REQ_KEY_TO_ID: Record<string, string> = {
  "high_aes_general_v41": "jimeng-4.1",
  "high_aes_general_v40l": "jimeng-4.5",
  "high_aes_general_v40": "jimeng-4.0",
  "high_aes_general_v30l_art:general_v3.0_18b": "jimeng-3.1",
  "high_aes_general_v30l_art_fangzhou:general_v3.0_18b": "jimeng-3.1",
  "high_aes_general_v30l:general_v3.0_18b": "jimeng-3.0",
  "high_aes_general_v20_L:general_v2.0_L": "jimeng-2.1",
  "high_aes_general_v21_L:general_v2.1_L": "jimeng-2.1",
  "high_aes_general_v20:general_v2.0": "jimeng-2.0",
  "high_aes_general_v14:general_v1.4": "jimeng-1.4",
  "high_aes_general_v14_xl:xl_v1.4": "jimeng-xl-pro",
  "text2img_xl_sft": "jimeng-xl-pro",
  "external_model_gemini_flash_image_v25": "nanobanana",
  "dreamina_image_lib_1": "nanobananapro",
};

// 图片尺寸信息
interface ImageRatioSize {
  ratio_type: number;
  width: number;
  height: number;
}

// 分辨率配置
interface ResolutionConfig {
  resolution_name: string;
  image_ratio_sizes: ImageRatioSize[];
  image_range_config?: {
    min_length: number;
    max_length: number;
    max_pixel_num: number;
  };
}

// 模型配置（官方 API 返回格式）
interface ImageModelConfig {
  model_name: string;
  model_req_key: string;
  model_tip?: string;
  icon_url?: string;
  is_new_model?: boolean;
  feats?: string[];
  resolution_map?: Record<string, ResolutionConfig>;
}

// 视频模型配置选项
interface VideoModelOption {
  key: string;
  value_type: string;
  enum_val?: {
    enum_type: string;
    string_value?: string[];
    int_value?: number[];
    double_value?: number[];
    default_val_idx: number;
  };
  slide_bar_val?: {
    min: number;
    max: number;
    step: number;
    default: number;
  };
  forbidden_display?: boolean;
}

// 视频模型配置（官方 API 返回格式）
interface VideoModelConfig {
  model_name: string;
  model_req_key: string;
  model_tip?: string;
  icon?: {
    image_url?: string;
    image_uri?: string;
  };
  options?: VideoModelOption[];
  extra?: Record<string, any>;
  commercial_config?: Record<string, any>;
}

// 解析后的视频模型详情
export interface ParsedVideoModelDetail {
  modelId: string;
  modelReqKey: string;
  modelName: string;
  modelTip?: string;
  iconUrl?: string;
  modelSource?: string;
  options: {
    key: string;
    valueType: string;
    values?: string[] | number[];
    defaultIndex?: number;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    hidden?: boolean;
  }[];
}

// 解析后的模型详情
interface ParsedModelDetail {
  modelId: string;
  modelReqKey: string;
  modelName: string;
  modelTip?: string;
  iconUrl?: string;
  isNew?: boolean;
  feats?: string[];
  resolutionMap: Record<string, Record<string, { width: number; height: number }>>;
  supportedResolutions: string[];
  supportedRatios: Record<string, string[]>;
}

// 站点配置（解析后）
interface SiteConfig {
  // 图片模型
  modelMap: Record<string, string>;
  reverseMap: Record<string, string>;
  modelDetails: Record<string, ParsedModelDetail>;
  modelList: ImageModelConfig[];
  defaultModelIndex: number;
  // 视频模型
  videoModelMap: Record<string, string>;
  videoModelDetails: Record<string, ParsedVideoModelDetail>;
  videoModelList: VideoModelConfig[];
  // 更新时间
  lastUpdated: string;
}

// 站点配置存储格式
interface SiteStoredConfigs {
  imageModels: ImageModelConfig[] | null;
  videoModels: VideoModelConfig[] | null;
}

// 本地存储的配置格式
interface StoredConfigs {
  china: SiteStoredConfigs;
  US: SiteStoredConfigs;
  HK: SiteStoredConfigs;
  JP: SiteStoredConfigs;
  SG: SiteStoredConfigs;
  lastUpdated: string | null;
}

// RegionInfo 接口（与 core.ts 保持一致）
export interface RegionInfo {
  isUS: boolean;
  isHK: boolean;
  isJP: boolean;
  isSG: boolean;
  isInternational: boolean;
  isCN: boolean;
}

// 配置文件路径
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE_PATH = path.join(__dirname, "../configs/model-configs.json");

class ModelConfigService {
  private siteConfigs: Partial<Record<SiteType, SiteConfig>> = {};
  private initialized = false;

  /**
   * 初始化配置服务（从本地 JSON 加载）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info("[ModelConfig] 初始化模型配置服务（从本地加载）...");
    await this.loadFromLocal();
    logger.info("[ModelConfig] 本地配置加载成功");

    this.initialized = true;
  }

  /**
   * 从本地 JSON 文件加载配置
   */
  private async loadFromLocal(): Promise<void> {
    if (!await fs.pathExists(CONFIG_FILE_PATH)) {
      throw new Error(`配置文件不存在: ${CONFIG_FILE_PATH}`);
    }

    const stored: StoredConfigs = await fs.readJson(CONFIG_FILE_PATH);

    const sites: SiteType[] = ["china", "US", "HK", "JP", "SG"];

    for (const site of sites) {
      const siteConfig = stored[site];
      const imageModels = siteConfig?.imageModels;
      const videoModels = siteConfig?.videoModels;

      if (!imageModels || imageModels.length === 0) {
        throw new Error(`站点 ${site} 的图片模型配置为空`);
      }

      this.siteConfigs[site] = this.parseModels(
        imageModels,
        videoModels || [],
        stored.lastUpdated || new Date().toISOString()
      );

      logger.info(`[ModelConfig] ${SITE_API_CONFIGS[site].name} 加载了 ${imageModels.length} 个图片模型, ${videoModels?.length || 0} 个视频模型`);
    }

    if (stored.lastUpdated) {
      logger.info(`[ModelConfig] 配置最后更新时间: ${stored.lastUpdated}`);
    }
  }

  /**
   * 从官方 API 刷新配置并保存到本地
   */
  async refreshFromApi(): Promise<{ success: boolean; message: string; details: Record<SiteType, { image: string; video: string }> }> {
    logger.info("[ModelConfig] 从官方 API 刷新配置...");

    const sites: SiteType[] = ["china", "US", "HK", "JP", "SG"];

    const stored: StoredConfigs = {
      china: { imageModels: null, videoModels: null },
      US: { imageModels: null, videoModels: null },
      HK: { imageModels: null, videoModels: null },
      JP: { imageModels: null, videoModels: null },
      SG: { imageModels: null, videoModels: null },
      lastUpdated: new Date().toISOString(),
    };

    const details: Record<SiteType, { image: string; video: string }> = {} as any;
    let successCount = 0;

    for (const site of sites) {
      details[site] = { image: "", video: "" };

      // 获取图片模型
      try {
        const imageModels = await this.fetchImageModelsFromApi(site);
        if (imageModels && imageModels.length > 0) {
          stored[site].imageModels = imageModels;
          details[site].image = `成功，${imageModels.length} 个模型`;
          logger.info(`[ModelConfig] ${SITE_API_CONFIGS[site].name} 图片模型刷新成功，${imageModels.length} 个模型`);
        } else {
          details[site].image = "返回数据为空";
        }
      } catch (error: any) {
        details[site].image = `失败: ${error.message}`;
        logger.error(`[ModelConfig] ${SITE_API_CONFIGS[site].name} 图片模型刷新失败: ${error.message}`);
      }

      // 获取视频模型
      try {
        const videoModels = await this.fetchVideoModelsFromApi(site);
        if (videoModels && videoModels.length > 0) {
          stored[site].videoModels = videoModels;
          details[site].video = `成功，${videoModels.length} 个模型`;
          logger.info(`[ModelConfig] ${SITE_API_CONFIGS[site].name} 视频模型刷新成功，${videoModels.length} 个模型`);
        } else {
          details[site].video = "返回数据为空";
        }
      } catch (error: any) {
        details[site].video = `失败: ${error.message}`;
        logger.error(`[ModelConfig] ${SITE_API_CONFIGS[site].name} 视频模型刷新失败: ${error.message}`);
      }

      // 如果至少有图片模型，更新内存中的配置
      if (stored[site].imageModels && stored[site].imageModels!.length > 0) {
        this.siteConfigs[site] = this.parseModels(
          stored[site].imageModels!,
          stored[site].videoModels || [],
          stored.lastUpdated!
        );
        successCount++;
      }
    }

    // 保存到本地文件
    if (successCount > 0) {
      try {
        await fs.writeJson(CONFIG_FILE_PATH, stored, { spaces: 2 });
        logger.info(`[ModelConfig] 配置已保存到本地: ${CONFIG_FILE_PATH}`);
      } catch (error: any) {
        logger.error(`[ModelConfig] 保存配置失败: ${error.message}`);
        return {
          success: false,
          message: `刷新成功但保存失败: ${error.message}`,
          details,
        };
      }
    }

    return {
      success: successCount > 0,
      message: successCount === sites.length
        ? "所有站点刷新成功"
        : `${successCount}/${sites.length} 个站点刷新成功`,
      details,
    };
  }

  /**
   * 从官方 API 获取单个站点的图片模型配置
   */
  private async fetchImageModelsFromApi(site: SiteType): Promise<ImageModelConfig[] | null> {
    const siteApi = SITE_API_CONFIGS[site];

    const headers = {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "appid": siteApi.appid,
      "appvr": "8.4.0",
      "lan": siteApi.lan,
      "loc": siteApi.loc,
      "pf": "7",
    };

    const isChina = site === "china";
    const body = isChina ? {} : { is_client_filter: true, need_beta_model: true };
    const queryParams = isChina
      ? "?needCache=true&needRefresh=false&aid=513695&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync"
      : "?needCache=true&needRefresh=false&aid=513641&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync";

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

  /**
   * 从官方 API 获取单个站点的视频模型配置
   */
  private async fetchVideoModelsFromApi(site: SiteType): Promise<VideoModelConfig[] | null> {
    const siteApi = SITE_API_CONFIGS[site];

    const headers = {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "appid": siteApi.appid,
      "appvr": "8.4.0",
      "lan": siteApi.lan,
      "loc": siteApi.loc,
      "pf": "7",
    };

    const isChina = site === "china";
    const queryParams = isChina
      ? "?aid=513695&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync"
      : "?aid=513641&web_version=7.5.0&da_version=3.3.4&aigc_features=app_lip_sync";

    // 国内站和国际站使用不同的 scene
    const scene = isChina ? "lip_sync_image_generate_video" : "generate_video";

    const response = await axios.post(
      siteApi.videoConfigApiUrl + queryParams,
      { scene, params: {} },
      { headers, timeout: 30000 }
    );

    const data = response.data;
    if (data.ret !== "0") {
      throw new Error(data.errmsg || "API 返回错误");
    }

    return data.data?.model_list || null;
  }

  /**
   * 解析图片和视频模型列表
   */
  private parseModels(imageModels: ImageModelConfig[], videoModels: VideoModelConfig[], lastUpdated: string): SiteConfig {
    // 解析图片模型
    const modelMap: Record<string, string> = {};
    const reverseMap: Record<string, string> = {};
    const modelDetails: Record<string, ParsedModelDetail> = {};

    for (const model of imageModels) {
      const modelReqKey = model.model_req_key;
      if (!modelReqKey) continue;

      const modelId = this.modelReqKeyToId(modelReqKey, model.model_name);

      modelMap[modelId] = modelReqKey;
      reverseMap[modelReqKey] = modelId;

      const resolutionMap: Record<string, Record<string, { width: number; height: number }>> = {};
      const supportedResolutions: string[] = [];
      const supportedRatios: Record<string, string[]> = {};

      if (model.resolution_map) {
        for (const [resolution, config] of Object.entries(model.resolution_map)) {
          supportedResolutions.push(resolution);
          resolutionMap[resolution] = {};
          supportedRatios[resolution] = [];

          if (config.image_ratio_sizes) {
            for (const size of config.image_ratio_sizes) {
              const ratioStr = RATIO_TYPE_MAP[size.ratio_type];
              if (ratioStr) {
                resolutionMap[resolution][ratioStr] = {
                  width: size.width,
                  height: size.height,
                };
                supportedRatios[resolution].push(ratioStr);
              }
            }
          }
        }
      }

      modelDetails[modelId] = {
        modelId,
        modelReqKey,
        modelName: model.model_name,
        modelTip: model.model_tip,
        iconUrl: model.icon_url,
        isNew: model.is_new_model,
        feats: model.feats,
        resolutionMap,
        supportedResolutions,
        supportedRatios,
      };
    }

    // 解析视频模型
    const videoModelMap: Record<string, string> = {};
    const videoModelDetails: Record<string, ParsedVideoModelDetail> = {};

    for (const model of videoModels) {
      const modelReqKey = model.model_req_key;
      if (!modelReqKey) continue;

      const modelId = this.videoModelReqKeyToId(modelReqKey, model.model_name);
      videoModelMap[modelId] = modelReqKey;

      const options: ParsedVideoModelDetail["options"] = [];
      if (model.options) {
        for (const opt of model.options) {
          const parsedOption: ParsedVideoModelDetail["options"][0] = {
            key: opt.key,
            valueType: opt.value_type,
            hidden: opt.forbidden_display,
          };

          if (opt.value_type === "enum" && opt.enum_val) {
            if (opt.enum_val.string_value) {
              parsedOption.values = opt.enum_val.string_value;
            } else if (opt.enum_val.int_value) {
              parsedOption.values = opt.enum_val.int_value;
            } else if (opt.enum_val.double_value) {
              parsedOption.values = opt.enum_val.double_value;
            }
            parsedOption.defaultIndex = opt.enum_val.default_val_idx;
          } else if (opt.value_type === "slide_bar" && opt.slide_bar_val) {
            parsedOption.min = opt.slide_bar_val.min;
            parsedOption.max = opt.slide_bar_val.max;
            parsedOption.step = opt.slide_bar_val.step;
            parsedOption.defaultValue = opt.slide_bar_val.default;
          }

          options.push(parsedOption);
        }
      }

      videoModelDetails[modelId] = {
        modelId,
        modelReqKey,
        modelName: model.model_name,
        modelTip: model.model_tip,
        iconUrl: model.icon?.image_url,
        modelSource: model.extra?.model_source,
        options,
      };
    }

    return {
      modelMap,
      reverseMap,
      modelDetails,
      modelList: imageModels,
      defaultModelIndex: 0,
      videoModelMap,
      videoModelDetails,
      videoModelList: videoModels,
      lastUpdated,
    };
  }

  /**
   * 将 model_req_key 转换为简化的模型 ID（图片模型）
   */
  private modelReqKeyToId(modelReqKey: string, modelName: string): string {
    if (MODEL_REQ_KEY_TO_ID[modelReqKey]) {
      return MODEL_REQ_KEY_TO_ID[modelReqKey];
    }

    const nameLower = modelName.toLowerCase();
    if (nameLower.includes("4.5")) return "jimeng-4.5";
    if (nameLower.includes("4.1")) return "jimeng-4.1";
    if (nameLower.includes("4.0")) return "jimeng-4.0";
    if (nameLower.includes("3.1")) return "jimeng-3.1";
    if (nameLower.includes("3.0")) return "jimeng-3.0";
    if (nameLower.includes("2.1") || nameLower.includes("2.0 pro")) return "jimeng-2.1";
    if (nameLower.includes("2.0")) return "jimeng-2.0";
    if (nameLower.includes("banana") && nameLower.includes("pro")) return "nanobananapro";
    if (nameLower.includes("banana")) return "nanobanana";

    return modelReqKey.split(":")[0].replace("high_aes_general_", "jimeng-");
  }

  /**
   * 将 model_req_key 转换为简化的模型 ID（视频模型）
   */
  private videoModelReqKeyToId(modelReqKey: string, modelName: string): string {
    // 视频模型使用原始 model_req_key 作为 ID，但进行简化
    const nameLower = modelName.toLowerCase();

    // 根据模型名称生成简化 ID（支持中英文）
    // 优先匹配更具体的名称
    if (nameLower.includes("video 3.0 pro") || nameLower.includes("3.0 pro") || modelName.includes("视频 3.0 Pro")) return "video-3.0-pro";
    if (nameLower.includes("video 3.0 fast") || nameLower.includes("3.0 fast") || modelName.includes("视频 3.0 Fast")) return "video-3.0-fast";
    if (nameLower.includes("video 3.0") || modelName.includes("视频 3.0")) return "video-3.0";
    if (nameLower.includes("video s2.0 pro") || nameLower.includes("s2.0 pro")) return "video-s2.0-pro";
    if (nameLower.includes("sora 2") || nameLower.includes("sora2")) return "sora-2";
    if (nameLower.includes("veo 3.1") || nameLower.includes("veo3.1")) return "veo-3.1";
    if (nameLower.includes("veo 3") || nameLower.includes("veo3")) return "veo-3";

    // 默认使用 model_req_key 的简化形式
    return modelReqKey
      .replace("dreamina_ic_generate_video_model_", "")
      .replace("dreamina_", "")
      .replace(/_/g, "-");
  }

  // ==================== 公共查询方法 ====================

  private getSiteFromRegion(regionInfo: RegionInfo): SiteType {
    if (regionInfo.isCN) return "china";
    if (regionInfo.isUS) return "US";
    if (regionInfo.isHK) return "HK";
    if (regionInfo.isJP) return "JP";
    if (regionInfo.isSG) return "SG";
    return "US";
  }

  private getConfigForRegion(regionInfo: RegionInfo): SiteConfig | undefined {
    const site = this.getSiteFromRegion(regionInfo);
    return this.siteConfigs[site];
  }

  getModelReqKey(modelId: string, regionInfo: RegionInfo): string | undefined {
    const config = this.getConfigForRegion(regionInfo);
    return config?.modelMap[modelId];
  }

  getModelMap(regionInfo: RegionInfo): Record<string, string> {
    const config = this.getConfigForRegion(regionInfo);
    if (!config) {
      throw new Error("模型配置未初始化");
    }
    return config.modelMap;
  }

  getSupportedModels(regionInfo: RegionInfo): string[] {
    return Object.keys(this.getModelMap(regionInfo));
  }

  isModelSupported(modelId: string, regionInfo: RegionInfo): boolean {
    const modelMap = this.getModelMap(regionInfo);
    return modelId in modelMap;
  }

  getDefaultModel(regionInfo: RegionInfo): string {
    const config = this.getConfigForRegion(regionInfo);
    if (config?.modelList?.length) {
      const defaultModel = config.modelList[config.defaultModelIndex];
      if (defaultModel) {
        return this.modelReqKeyToId(defaultModel.model_req_key, defaultModel.model_name);
      }
    }
    return "jimeng-4.1";
  }

  getModelDetail(modelId: string, regionInfo: RegionInfo): ParsedModelDetail | undefined {
    const config = this.getConfigForRegion(regionInfo);
    return config?.modelDetails[modelId];
  }

  getSupportedResolutions(modelId: string, regionInfo: RegionInfo): string[] {
    const detail = this.getModelDetail(modelId, regionInfo);
    if (!detail) {
      throw new Error(`模型 "${modelId}" 不存在`);
    }
    return detail.supportedResolutions;
  }

  getSupportedRatios(modelId: string, resolution: string, regionInfo: RegionInfo): string[] {
    const detail = this.getModelDetail(modelId, regionInfo);
    if (!detail) {
      throw new Error(`模型 "${modelId}" 不存在`);
    }
    return detail.supportedRatios[resolution] || [];
  }

  getImageSize(modelId: string, resolution: string, ratio: string, regionInfo: RegionInfo): { width: number; height: number } | undefined {
    const detail = this.getModelDetail(modelId, regionInfo);
    return detail?.resolutionMap[resolution]?.[ratio];
  }

  getRatioType(ratio: string): number {
    return RATIO_STRING_MAP[ratio] || 1;
  }

  private getSiteName(regionInfo: RegionInfo): string {
    if (regionInfo.isCN) return "国内版";
    if (regionInfo.isUS) return "美国站";
    if (regionInfo.isHK) return "香港站";
    if (regionInfo.isJP) return "日本站";
    if (regionInfo.isSG) return "新加坡站";
    return "国际版";
  }

  validateParams(
    modelId: string,
    resolution: string,
    ratio: string,
    regionInfo: RegionInfo
  ): string | null {
    const siteName = this.getSiteName(regionInfo);

    if (!this.isModelSupported(modelId, regionInfo)) {
      const supportedModels = this.getSupportedModels(regionInfo).join(", ");
      return `${siteName}不支持模型 "${modelId}"。支持的模型: ${supportedModels}`;
    }

    const detail = this.getModelDetail(modelId, regionInfo);
    if (!detail) {
      return `无法获取模型 "${modelId}" 的配置信息`;
    }

    if (!detail.supportedResolutions.includes(resolution)) {
      return `模型 "${modelId}" 不支持分辨率 "${resolution}"。支持的分辨率: ${detail.supportedResolutions.join(", ")}`;
    }

    const supportedRatios = detail.supportedRatios[resolution] || [];
    if (supportedRatios.length > 0 && !supportedRatios.includes(ratio)) {
      return `模型 "${modelId}" 在分辨率 "${resolution}" 下不支持比例 "${ratio}"。支持的比例: ${supportedRatios.join(", ")}`;
    }

    return null;
  }

  getImageSizeWithValidation(
    modelId: string,
    resolution: string,
    ratio: string,
    regionInfo: RegionInfo
  ): { width: number; height: number; ratioType: number } {
    const error = this.validateParams(modelId, resolution, ratio, regionInfo);
    if (error) {
      throw new Error(error);
    }

    const size = this.getImageSize(modelId, resolution, ratio, regionInfo);
    if (!size) {
      throw new Error(`无法获取模型 "${modelId}" 在分辨率 "${resolution}" 比例 "${ratio}" 下的尺寸`);
    }

    return {
      ...size,
      ratioType: this.getRatioType(ratio),
    };
  }

  // ==================== 视频模型查询方法 ====================

  /**
   * 获取视频模型的 model_req_key
   */
  getVideoModelReqKey(modelId: string, regionInfo: RegionInfo): string | undefined {
    const config = this.getConfigForRegion(regionInfo);
    return config?.videoModelMap[modelId];
  }

  /**
   * 获取支持的视频模型列表
   */
  getSupportedVideoModels(regionInfo: RegionInfo): string[] {
    const config = this.getConfigForRegion(regionInfo);
    return config ? Object.keys(config.videoModelMap) : [];
  }

  /**
   * 检查视频模型是否支持
   */
  isVideoModelSupported(modelId: string, regionInfo: RegionInfo): boolean {
    const config = this.getConfigForRegion(regionInfo);
    return !!config?.videoModelMap[modelId];
  }

  /**
   * 获取视频模型详情
   */
  getVideoModelDetail(modelId: string, regionInfo: RegionInfo): ParsedVideoModelDetail | undefined {
    const config = this.getConfigForRegion(regionInfo);
    return config?.videoModelDetails[modelId];
  }

  /**
   * 获取所有视频模型详情
   */
  getAllVideoModelDetails(regionInfo: RegionInfo): ParsedVideoModelDetail[] {
    const config = this.getConfigForRegion(regionInfo);
    return config ? Object.values(config.videoModelDetails) : [];
  }

  /**
   * 获取配置状态信息
   */
  getStatus(): {
    sites: Record<SiteType, { imageModelCount: number; videoModelCount: number; lastUpdated: string }>;
    configFilePath: string;
  } {
    const sites: SiteType[] = ["china", "US", "HK", "JP", "SG"];
    const status: Record<SiteType, { imageModelCount: number; videoModelCount: number; lastUpdated: string }> = {} as any;

    for (const site of sites) {
      const config = this.siteConfigs[site];
      status[site] = {
        imageModelCount: config ? Object.keys(config.modelMap).length : 0,
        videoModelCount: config ? Object.keys(config.videoModelMap).length : 0,
        lastUpdated: config?.lastUpdated || "未加载",
      };
    }

    return {
      sites: status,
      configFilePath: CONFIG_FILE_PATH,
    };
  }

  /**
   * 获取所有站点的完整配置（供前端直接使用）
   * 返回格式兼容前端期望的 ApiSiteConfig[]
   */
  getAllSiteConfigs(): Array<{
    code: string;
    name: string;
    description: string;
    home_url: string;
    model_list: Array<{
      model_name: string;
      model_req_key: string;
      model_id: string;
      model_tip?: string;
      icon_url?: string;
      is_new_model?: boolean;
      resolution_map?: Record<string, {
        resolution_name?: string;
        image_ratio_sizes?: Array<{ ratio_type: number; width: number; height: number }>;
      }>;
    }>;
    default_model_index: number;
  }> {
    const sites: SiteType[] = ["china", "US", "HK", "JP", "SG"];
    const result = [];

    for (const site of sites) {
      const config = this.siteConfigs[site];
      const siteApiConfig = SITE_API_CONFIGS[site];

      if (!config) continue;

      // 构建 model_list，添加 model_id 字段
      const modelList = config.modelList.map(model => {
        const modelId = this.modelReqKeyToId(model.model_req_key, model.model_name);
        return {
          model_name: model.model_name,
          model_req_key: model.model_req_key,
          model_id: modelId,
          model_tip: model.model_tip,
          icon_url: model.icon_url,
          is_new_model: model.is_new_model,
          resolution_map: model.resolution_map,
        };
      });

      result.push({
        code: site === "china" ? "china" : site.toLowerCase(),
        name: siteApiConfig.name,
        description: this.getSiteDescription(site),
        home_url: this.getSiteHomeUrl(site),
        model_list: modelList,
        default_model_index: config.defaultModelIndex,
      });
    }

    return result;
  }

  /**
   * 获取站点描述
   */
  private getSiteDescription(site: SiteType): string {
    const descriptions: Record<SiteType, string> = {
      china: "即梦AI中国站，需要国内网络访问",
      US: "Dreamina 国际站（美国），需要国际网络访问",
      HK: "Dreamina 国际站（香港），需要国际网络访问",
      JP: "Dreamina 国际站（日本），需要国际网络访问",
      SG: "Dreamina 国际站（新加坡），需要国际网络访问",
    };
    return descriptions[site];
  }

  /**
   * 获取站点首页 URL
   */
  private getSiteHomeUrl(site: SiteType): string {
    const urls: Record<SiteType, string> = {
      china: "https://jimeng.jianying.com/ai-tool/home",
      US: "https://dreamina.capcut.com/",
      HK: "https://dreamina.capcut.com/",
      JP: "https://dreamina.capcut.com/",
      SG: "https://dreamina.capcut.com/",
    };
    return urls[site];
  }
}

// 导出单例
export const modelConfigService = new ModelConfigService();
export default modelConfigService;
