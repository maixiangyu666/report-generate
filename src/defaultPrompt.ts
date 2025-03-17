interface PromptConfig {
  commits: string;
  start_date?: string;
  end_date?: string;
  additionalInfo?: string;
}

export function buildPrompt(reportType: string, config: PromptConfig): string {
    const { commits, start_date, end_date, additionalInfo } = config;
    const getCommits= `提交记录:\n\n${commits} `;
    let prompt = getCommits +`请根据提交记录生成${reportType}报，提炼并总结。格式要整齐排列。`;
        
    if (additionalInfo) {
        prompt += `上下文信息
    ${additionalInfo}\n\n`;
      }
    
    return prompt;
  }
  
