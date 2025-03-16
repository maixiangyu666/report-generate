import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import axios, { AxiosInstance } from 'axios';
import cron from 'node-cron';
import { ConfigPanel } from './configPanel';
import { buildPrompt } from './defaultPrompt';
import {  StreamWriter} from "./streamWriter";
import dayjs  from 'dayjs';
interface ReportConfig {
  projectPath: string;
  aiModel: string;
  apiKey: string;
  dailyReportTime: string;
  weeklyReportDay: string;
  monthlyReportDay: number;
  reportType: string;
  startDate: string;
  endDate: string;
  baseURL: string;
  modelId: string;
  timeRange: string;
  additionalInfo: string;
  projects?: Array<{
    name: string;
    path: string;
  }>;
}

export class ReportGenerator {
  private git;
  private config: vscode.WorkspaceConfiguration;

  private streamWriter: StreamWriter;

  constructor() {
     console.log('Initializing ReportGenerator');
    this.config = vscode.workspace.getConfiguration('reportGenerator');
    this.git = simpleGit();
    this.streamWriter = new StreamWriter();
    console.log('Current config:', this.getCurrentConfig());
  }

  private async getGitCommits(since: string): Promise<string[]> {
    try {
      const log = await this.git.log({ since });
      return log.all.map((commit: { date: string; message: string }) => `${commit.date}: ${commit.message}`);
    } catch ( error) {
      vscode.window.showErrorMessage('Failed to retrieve git commits');
      return [];
    }
  }

  private async generateAIReport(commits: string[], period: string): Promise<string> {
    const model = this.config.get<string>('aiModel') || 'deepseek';
    const apiKey = this.config.get<string>('apiKey') || '';
    
    const prompt = `Generate a concise ${period} report based on these git commits:\n\n${
      commits.join('\n')
    }\n\nFocus on key changes, progress made, and important updates.`;

    try {
      const response = await axios.post(
        this.getModelEndpoint(model),
        { prompt },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      vscode.window.showErrorMessage('Failed to generate report with AI');
      return '';
    }
  }

  private getModelEndpoint(model: string): string {
    switch (model) {
      case 'deepseek':
        return 'https://api.deepseek.com/v1/chat/completions';
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      default:
        return '';
    }
  }

  public async generateReport(config: ReportConfig) {
    const { projects, startDate, endDate, timeRange, additionalInfo, baseURL, modelId, apiKey } = config;
    
    if (!projects || projects.length === 0) {
      throw new Error('At least one project is required');
    }

    let allCommits: string[] = [];
    
    // Get commits for each project
    for (const project of projects) {
      this.git.cwd(project.path);
      const commits = await this.git.log([
        '--since',
        startDate,
        '--until', 
        endDate,
        '--date=iso'
      ]);
      
      allCommits.push(
        ...commits.all.map(commit => 
          `${dayjs(commit.date).format('YYYY-MM-DD HH:mm:ss')}: ${commit.message}`
        )
      );
    }

    if (allCommits.length === 0) {
      throw new Error(`No commits found between ${startDate} and ${endDate}`);
    }

    // Generate AI report with streaming
    const finalReport = await this.generateStreamingAIReport(allCommits, config);



    return finalReport;
  }

  private async generateStreamingAIReport(
    commits: string[],
    config: ReportConfig
  ): Promise<string> {
    const { baseURL, modelId, apiKey, reportType, startDate, endDate, additionalInfo } = config;

    const prompt = buildPrompt(reportType || 'daily', {
      commits: commits.join('\n'),
      start_date: startDate,
      end_date: endDate,
      additionalInfo: additionalInfo
    });

 console.log('Generating report with AI:', prompt,commits);
    try {
      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model: modelId,
          messages: [
            {role:'system',content:'本次对话为独立会话，请忽略之前所有对话历史'},
            { role: "user", content: prompt }
          ],
          stream: true
        },
        {
          headers: { 
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

 

      // let editor = vscode.window.activeTextEditor;
      // if (!editor) {
      //   // Create new document if no active editor exists
      //   const doc = await vscode.workspace.openTextDocument({
      //     language: 'markdown'
      //   });
      //   editor = await vscode.window.showTextDocument(doc);
      // }
      this.streamWriter.prepareEditor();



      // const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      // console.log('AI response:', response.data);
      response.data.on('data', async (chunk: Buffer) => {
        let contents = '';
        try {
          const lines = chunk.toString().split('\n');
          // console.log('Lines:', lines);

          for (const line of lines) {
            if (line.trim().indexOf('[DONE]') > -1) {
              // Finalize the report
              // await editor.edit(editBuilder => {
              //   const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
              //   const position = lastLine.range.end;
              //   editBuilder.insert(position, '\n\n## Report Complete');
              // });
              this.streamWriter.writeStream('\n\n## Report Complete');
              continue;
            }
            if (line.trim() === '') {continue;} // 跳过空行

            console.log('AI response:', line,line.indexOf('data') ,JSON.parse(line.slice(6)).choices[0].delta.content);
            
            if (line.indexOf('data') > -1) {
              const data = JSON.parse(line.slice(6));
              if (data.choices[0].delta.content) {
                let content = data.choices[0].delta.content;
                contents += content;
                console.log('Writing to editor11:', contents);
              }
            }
          }

          this.streamWriter.writeStream(contents);
     
        } catch (error) {
          console.error('Error processing AI response:', error);
        }
      });

      await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });

      // return 'Report generated successfully';
    } catch (error) {
      vscode.window.showErrorMessage('Failed to generate report with AI');
      return '';
    }
  }

  public async showReport(period: string) {
    console.log(`Generating ${period} report`);
    const projectPath = this.config.get<string>('projectPath');
    if (!projectPath) {
      const msg = 'Project path not configured';
      console.error(msg);
      vscode.window.showErrorMessage(msg);
      return;
    }

    this.git.cwd(projectPath);
    
    const since = this.getSinceDate(period);
    const commits = await this.getGitCommits(since);
    
    if (commits.length > 0) {
      const report = await this.generateAIReport(commits, period);
      if (report) {
        const doc = await vscode.workspace.openTextDocument({
          content: report,
          language: 'markdown'
        });
        vscode.window.showTextDocument(doc);
      }
    } else {
      vscode.window.showInformationMessage(`No commits found for ${period} report`);
    }
  }

  private getSinceDate(period: string): string {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.setDate(now.getDate() - 1)).toISOString();
      case 'weekly':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      default:
        return new Date().toISOString();
    }
  }
  public getCurrentConfig(): ReportConfig {
    const config = vscode.workspace.getConfiguration('reportGenerator');

    console.log('Current config:', config);
    return {
      projectPath: config.get<string>('projectPath') || '',
      aiModel: config.get<string>('aiModel') || 'deepseek',
      apiKey: config.get<string>('apiKey') || '',
      dailyReportTime: config.get<string>('dailyReportTime') || '09:00',
      weeklyReportDay: config.get<string>('weeklyReportDay') || 'Monday',
      monthlyReportDay: config.get<number>('monthlyReportDay') || 1,
      reportType: config.get<string>('reportType') || 'daily',
      startDate: config.get<string>('startDate') || '',
      endDate: config.get<string>('endDate') || '',
      baseURL: config.get<string>('baseURL') || '',
      modelId: config.get<string>('modelId') || '',
      timeRange: config.get<string>('timeRange') || '',
      additionalInfo: config.get<string>('additionalInfo') || '',
      projects: config.get<Array<{ name: string, path: string }>>('projects') || []
    };
  }

  public async saveConfig(config: any): Promise<void> {
    try {
      // Update all configuration properties in a single transaction
      await this.config.update('startDate', config.startDate, vscode.ConfigurationTarget.Global);
      await this.config.update('endDate', config.endDate, vscode.ConfigurationTarget.Global);
      await this.config.update('baseURL', config.baseURL, vscode.ConfigurationTarget.Global);
      await this.config.update('modelId', config.modelId, vscode.ConfigurationTarget.Global);
      await this.config.update('timeRange', config.timeRange, vscode.ConfigurationTarget.Global);
      await this.config.update('additionalInfo', config.additionalInfo, vscode.ConfigurationTarget.Global);
      await this.config.update('reportType', config.reportType, vscode.ConfigurationTarget.Global);
      await this.config.update('aiModel', config.aiModel, vscode.ConfigurationTarget.Global);
      await this.config.update('apiKey', config.apiKey, vscode.ConfigurationTarget.Global);
      await this.config.update('dailyReportTime', config.dailyReportTime, vscode.ConfigurationTarget.Global);
      await this.config.update('weeklyReportDay', config.weeklyReportDay, vscode.ConfigurationTarget.Global);
      await this.config.update('monthlyReportDay', config.monthlyReportDay, vscode.ConfigurationTarget.Global);
      
      // Ensure projects array is properly formatted before saving
      const projects = Array.isArray(config.projects) ? config.projects : [];
      await this.config.update('projects', projects, vscode.ConfigurationTarget.Global);
      
      // Verify the configuration was saved correctly
      const savedConfig = this.getCurrentConfig();
      if (!savedConfig.projects || !Array.isArray(savedConfig.projects)) {
        throw new Error('Failed to save projects configuration');
      }
      
      // Force settings.json to be written to disk
      // await vscode.workspace.getConfiguration().update('reportGenerator', undefined, vscode.ConfigurationTarget.Global);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }


  public setupSchedules() {
    // Daily schedule
    const dailyTime = this.config.get<string>('dailyReportTime') || '09:00';
    cron.schedule(`0 ${dailyTime.split(':')[1]} ${dailyTime.split(':')[0]} * * *`, () => {
      this.showReport('daily');
    });

    // Weekly schedule
    const weeklyDay = this.config.get<string>('weeklyReportDay') || 'Monday';
    cron.schedule(`0 0 9 * * ${weeklyDay}`, () => {
      this.showReport('weekly');
    });

    // Monthly schedule
    const monthlyDay = this.config.get<number>('monthlyReportDay') || 1;
    cron.schedule(`0 0 9 ${monthlyDay} * *`, () => {
      this.showReport('monthly');
    });
  }
}

class SettingsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }
}



export function activate(context: vscode.ExtensionContext) {
  const reportGenerator = new ReportGenerator();


  
  // Register configuration panel
  const configPanel = new ConfigPanel(context, reportGenerator);


  
  // Register commands and views
  context.subscriptions.push(
    // vscode.commands.registerCommand('report-generate.generateDailyReport', () => {
    //   reportGenerator.showReport('daily');
    // }),
    // vscode.commands.registerCommand('report-generate.generateWeeklyReport', () => {
    //   reportGenerator.showReport('weekly');
    // }),
    // vscode.commands.registerCommand('report-generate.generateMonthlyReport', () => {
    //   reportGenerator.showReport('monthly');
    // }),

    // vscode.commands.registerCommand('report-generate.configureSettings', () => {
    //   // Open settings view when configure command is called
    //   vscode.commands.executeCommand('workbench.view.extension.report-generate');
    // }),
    vscode.window.registerWebviewViewProvider(
      ConfigPanel.viewType,
      configPanel
    )
  );

  // Setup scheduled reports
  reportGenerator.setupSchedules();
}
