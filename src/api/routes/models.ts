import _ from 'lodash';
import { modelConfigService, RegionInfo, ParsedVideoModelDetail } from '@/lib/model-config.ts';

// 预定义的 RegionInfo 对象
const CN_REGION: RegionInfo = { isCN: true, isUS: false, isHK: false, isJP: false, isSG: false, isInternational: false };
const US_REGION: RegionInfo = { isCN: false, isUS: true, isHK: false, isJP: false, isSG: false, isInternational: true };
const HK_REGION: RegionInfo = { isCN: false, isUS: false, isHK: true, isJP: false, isSG: false, isInternational: true };
const JP_REGION: RegionInfo = { isCN: false, isUS: false, isHK: false, isJP: true, isSG: false, isInternational: true };
const SG_REGION: RegionInfo = { isCN: false, isUS: false, isHK: false, isJP: false, isSG: true, isInternational: true };

export default {

    prefix: '/v1',

    get: {
        '/models': async () => {
            // 获取各站点的动态图片模型列表
            const cnModels = modelConfigService.getSupportedModels(CN_REGION);
            const usModels = modelConfigService.getSupportedModels(US_REGION);
            const hkModels = modelConfigService.getSupportedModels(HK_REGION);
            const jpModels = modelConfigService.getSupportedModels(JP_REGION);
            const sgModels = modelConfigService.getSupportedModels(SG_REGION);

            // 合并所有站点的图片模型（去重）
            const allImageModels = [...new Set([...cnModels, ...usModels, ...hkModels, ...jpModels, ...sgModels])];

            const imageModelList = allImageModels.map(id => ({
                id,
                object: "model",
                owned_by: "jimeng-api",
                type: "image",
                supported_regions: {
                    china: cnModels.includes(id),
                    US: usModels.includes(id),
                    HK: hkModels.includes(id),
                    JP: jpModels.includes(id),
                    SG: sgModels.includes(id),
                }
            }));

            // 获取各站点的动态视频模型列表
            const cnVideoModels = modelConfigService.getSupportedVideoModels(CN_REGION);
            const usVideoModels = modelConfigService.getSupportedVideoModels(US_REGION);
            const hkVideoModels = modelConfigService.getSupportedVideoModels(HK_REGION);
            const jpVideoModels = modelConfigService.getSupportedVideoModels(JP_REGION);
            const sgVideoModels = modelConfigService.getSupportedVideoModels(SG_REGION);

            // 合并所有站点的视频模型（去重）
            const allVideoModels = [...new Set([...cnVideoModels, ...usVideoModels, ...hkVideoModels, ...jpVideoModels, ...sgVideoModels])];

            const videoModelList = allVideoModels.map(id => ({
                id,
                object: "model",
                owned_by: "jimeng-api",
                type: "video",
                supported_regions: {
                    china: cnVideoModels.includes(id),
                    US: usVideoModels.includes(id),
                    HK: hkVideoModels.includes(id),
                    JP: jpVideoModels.includes(id),
                    SG: sgVideoModels.includes(id),
                }
            }));

            return {
                "data": [
                    ...imageModelList,
                    ...videoModelList,
                ]
            };
        },

        '/models/image': async () => {
            // 返回各站点的图像模型列表
            const cnModels = modelConfigService.getSupportedModels(CN_REGION);
            const usModels = modelConfigService.getSupportedModels(US_REGION);
            const hkModels = modelConfigService.getSupportedModels(HK_REGION);
            const jpModels = modelConfigService.getSupportedModels(JP_REGION);
            const sgModels = modelConfigService.getSupportedModels(SG_REGION);

            return {
                data: {
                    china: cnModels,
                    US: usModels,
                    HK: hkModels,
                    JP: jpModels,
                    SG: sgModels,
                }
            };
        },

        '/models/video': async () => {
            // 返回各站点的视频模型列表及详情
            const regions = {
                china: CN_REGION,
                US: US_REGION,
                HK: HK_REGION,
                JP: JP_REGION,
                SG: SG_REGION,
            };

            const result: Record<string, ParsedVideoModelDetail[]> = {};

            for (const [site, region] of Object.entries(regions)) {
                result[site] = modelConfigService.getAllVideoModelDetails(region);
            }

            return { data: result };
        },

        '/models/config/status': async () => {
            // 返回配置状态信息
            return modelConfigService.getStatus();
        }
    },

    post: {
        '/models/config/refresh': async () => {
            // 从官方 API 刷新配置
            const result = await modelConfigService.refreshFromApi();
            return result;
        }
    }
}