/**
 * 即梦API通用常量
 */

// API基础URL
export const BASE_URL_CN = "https://jimeng.jianying.com";

export const BASE_URL_US_COMMERCE = "https://commerce.us.capcut.com";
export const BASE_URL_HK_COMMERCE = "https://commerce-api-sg.capcut.com";
export const BASE_URL_HK = "https://mweb-api-sg.capcut.com";

// 默认助手ID
export const DEFAULT_ASSISTANT_ID_CN = 513695;
export const DEFAULT_ASSISTANT_ID_US = 513641;
export const DEFAULT_ASSISTANT_ID_HK = 513641;
export const DEFAULT_ASSISTANT_ID_JP = 513641;
export const DEFAULT_ASSISTANT_ID_SG = 513641;

// 地区
export const REGION_CN = "cn";
export const REGION_US = "US";
export const REGION_HK = "HK";
export const REGION_JP = "JP";
export const REGION_SG = "SG";

// 平台代码
export const PLATFORM_CODE = "7";

// 版本代码
export const VERSION_CODE = "5.8.0";

// 默认模型
export const DEFAULT_IMAGE_MODEL = "jimeng-4.1";
export const DEFAULT_VIDEO_MODEL = "jimeng-video-3.0";

// 草稿版本
export const DRAFT_VERSION = "3.3.4";
export const DRAFT_MIN_VERSION = "3.0.2";

// 状态码映射
export const STATUS_CODE_MAP = {
  20: 'PROCESSING',
  10: 'SUCCESS',
  30: 'FAILED',
  42: 'POST_PROCESSING',
  45: 'FINALIZING',
  50: 'COMPLETED'
};

// 重试配置
export const RETRY_CONFIG = {
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 5000
};

// 轮询配置
export const POLLING_CONFIG = {
  MAX_POLL_COUNT: 900, // 15分钟
  POLL_INTERVAL: 5000, // 1秒
  STABLE_ROUNDS: 5,    // 稳定轮次
  TIMEOUT_SECONDS: 900 // 15分钟超时
};

