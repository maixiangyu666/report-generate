import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import axios, { AxiosInstance } from 'axios';
import cron from 'node-cron';
import path from 'path';
//allowImportingTsExtensions
import { ConfigPanel } from './configPanel';
import { fetchEventSource } from '@microsoft/fetch-event-source';
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

  constructor() {
     console.log('Initializing ReportGenerator');
    this.config = vscode.workspace.getConfiguration('reportGenerator');
    this.git = simpleGit();
    console.log('Current config:', this.getCurrentConfig());
  }

  private async getGitCommits(since: string): Promise<string[]> {
    try {
      const log = await this.git.log({ since });
      return log.all.map((commit: { date: string; message: string }) => `${commit.date}: ${commit.message}`);
    } catch (error) {
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
          `[${project.name}] ${commit.date}: ${commit.message}`
        )
      );
    }

    if (allCommits.length === 0) {
      throw new Error(`No commits found between ${startDate} and ${endDate}`);
    }

    // Generate AI report with streaming
    const report = await this.generateStreamingAIReport(allCommits, {
      baseURL,
      modelId,
      apiKey
    });

    // Format final report
    let finalReport = `# Project Report\n\n`;
    finalReport += `**Time Range:** ${startDate} to ${endDate}\n\n`;
    finalReport += report;
    
    if (additionalInfo) {
      finalReport += `\n\n**Additional Information:**\n${additionalInfo}`;
    }

    return finalReport;
  }

  private async generateStreamingAIReport(
    commits: string[],
    config: { baseURL: string; modelId: string; apiKey: string }
  ): Promise<string> {
    const { baseURL, modelId, apiKey } = config;
    
    const prompt = `Analyze these git commits and generate a report:\n\n${
      commits.join('\n')
    }\n\nFocus on key changes, progress made, and important updates.`;

    // console.log('Generating report with AI:', prompt,commits);
    try {
      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model: modelId,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
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

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active document found');
        return '';
      }

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      console.log('AI response:', response.data);
      response.data.on('data', async (chunk: Buffer) => {
        try {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (data.choices[0].delta.content) {
                let content = data.choices[0].delta.content;
                console.log('Writing to editor:', content);
                
                // Ensure editor is in markdown mode
                if (editor.document.languageId !== 'markdown') {
                  await vscode.languages.setTextDocumentLanguage(editor.document, 'markdown');
                }
                
                // Enhanced markdown processing
                const markdownPatterns = [
                  { regex: /```([\s\S]*?)```/g, replace: '```$1```' }, // Preserve code blocks
                  { regex: /### (.*)/g, replace: '### $1' }, // Preserve headers
                  { regex: /\*\*(.*?)\*\*/g, replace: '**$1**' }, // Preserve bold
                  { regex: /\*(.*?)\*/g, replace: '*$1*' }, // Preserve italics
                  { regex: /!\[(.*?)\]\((.*?)\)/g, replace: '![$1]($2)' }, // Preserve images
                  { regex: /\[(.*?)\]\((.*?)\)/g, replace: '[$1]($2)' }, // Preserve links
                  { regex: /^- (.*)/g, replace: '- $1' }, // Preserve lists
                  { regex: /^\d+\. (.*)/g, replace: '$&' } // Preserve numbered lists
                ];

                // Apply markdown formatting
                for (const pattern of markdownPatterns) {
                  content = content.replace(pattern.regex, pattern.replace);
                }

                await editor.edit(editBuilder => {
                  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
                  const position = lastLine.range.end;
                  editBuilder.insert(position, content);
                });
                await sleep(50); // Adjust typing speed here
              }
            }
          }
        } catch (error) {
          console.error('Error processing AI response:', error);
        }
      });

      await new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });

      return 'Report generated successfully';
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

  // public async updateConfig(config: ReportConfig): Promise<void> {
  //   console.log('Updating config:', config);
  //   await this.config.update('projectPath', config.projectPath, vscode.ConfigurationTarget.Global);
  //   await this.config.update('aiModel', config.aiModel, vscode.ConfigurationTarget.Global);
  //   await this.config.update('apiKey', config.apiKey, vscode.ConfigurationTarget.Global);
  //   await this.config.update('dailyReportTime', config.dailyReportTime, vscode.ConfigurationTarget.Global);
  //   await this.config.update('weeklyReportDay', config.weeklyReportDay, vscode.ConfigurationTarget.Global);
  //   await this.config.update('monthlyReportDay', config.monthlyReportDay, vscode.ConfigurationTarget.Global);
  //   console.log('Config updated successfully');
  // }

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

class SettingsTreeDataProvider implements vscode.TreeDataProvider<SettingsTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SettingsTreeItem | undefined | null> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SettingsTreeItem | undefined | null> = this._onDidChangeTreeData.event;

  constructor(private reportGenerator: ReportGenerator) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: SettingsTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SettingsTreeItem): Thenable<SettingsTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    return Promise.resolve([
      new SettingsTreeItem(
        'Project Path',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'report-generate.configureSettings',
          title: 'Configure Project Path'
        }
      ),
      new SettingsTreeItem(
        'AI Model',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'report-generate.configureSettings',
          title: 'Configure AI Model'
        }
      ),
      new SettingsTreeItem(
        'API Key1',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'report-generate.configureSettings',
          title: 'Configure API Key'
        }
      ),
      new SettingsTreeItem(
        'Report Schedules',
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          command: 'report-generate.configureSettings',
          title: 'Configure Report Schedules'
        }
      )
    ]);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const reportGenerator = new ReportGenerator();

  // Create tree data provider
  const settingsTreeDataProvider = new SettingsTreeDataProvider(reportGenerator);
  
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
    // vscode.window.registerTreeDataProvider(
    //   'report-generate.settings',
    //   settingsTreeDataProvider
    // ),
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

export function deactivate() {}
