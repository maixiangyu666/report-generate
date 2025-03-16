interface PromptConfig {
  commits: string;
  start_date?: string;
  end_date?: string;
  additionalInfo?: string;
}

export function buildPrompt(reportType: string, config: PromptConfig): string {
    const { commits, start_date, end_date, additionalInfo } = config;

    const getCommits= `### 提交记录:\n\n${commits} `;

    
    const dateFormatRules = `
  ## 严格遵循以下格式规范：
  1. 日期格式：使用「YYYY年MM月DD日」中文格式（示例：2023年10月15日）
  2. 时间范围：
     - 日报：按自然日分组，无提交日标注「无记录」
     - 周报：每周一至周五，忽略节假日
     - 月报：每月1日至最后自然日
  3. 多周期处理：当${reportType}跨多周/月时，使用分节符隔开`;
  

    let prompt = getCommits + `\n\n作为Git提交分析专家，请严格按以下要求生成${reportType}报告：\n\n`;
    
    prompt += `### 原始数据说明
  - 提交记录：共${commits.length}条（已按时间排序）
  - 时间范围：${start_date} ~ ${end_date}`;
  

    

  
    prompt += dateFormatRules + '\n\n';

    prompt += `请根据提交的commits生成，不能生成与提交的commits无关的日报，除非用户声明了### 上下文信息！如果用户声明了上下文信息，请根据上下文信息生成各类报告！`;
        
    if (additionalInfo) {
        prompt += `### 上下文信息
    ${additionalInfo}\n\n`;
      }
    
    return prompt;
  }
  
