interface PromptConfig {
  commits: string;
  start_date?: string;
  end_date?: string;
  additionalInfo?: string;
}

export function buildPrompt(reportType: string, config: PromptConfig): string {
    const { commits, start_date, end_date, additionalInfo } = config;
    const getCommits= `提交记录:\n\n${commits} `;
    let prompt = getCommits + `请根据提交记录生成${reportType}报告，要求：
    1.按照不同的${reportType}类型，按时间顺序描述工作内容；
    2. 归纳总结工作内容，务必详细描述，可根据提交词描述扩充；
    3. 提炼关键点 ；
    4. 格式要整齐排列，层次分明
    5.不显示Git提交记录描述 ,应该是总结性的描述，feature/bugfix/fixbug/feat/fixed等不应该出现在报告中，它们都有对应的描述
    `;
        
    if (additionalInfo) {
        prompt += `上下文信息
    ${additionalInfo}\n\n`;
      }
    
    return prompt;
  }
