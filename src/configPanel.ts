import * as vscode from 'vscode';
import { ReportGenerator } from './extension.js';

export class ConfigPanel implements vscode.WebviewViewProvider {
  static viewType = 'report-generate.settings';
  
  private _view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private reportGenerator: ReportGenerator;

  constructor(context: vscode.ExtensionContext, reportGenerator: ReportGenerator) {
    this.context = context;
    this.reportGenerator = reportGenerator;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'src')
      ]
    };

    webviewView.webview.html = this.getWebviewContent();
    this.setupMessageHandlers(webviewView);

    // Load initial configuration
    const config = this.reportGenerator.getCurrentConfig();
    webviewView.webview.postMessage({
      command: 'loadConfig',
      config
    });
  }

  getWebviewContent() {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Generator Configuration</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            margin: 0;
          }
          
          h1 {
            font-size: 1.5em;
            font-weight: 600;
            margin: 0 0 16px 0;
            color: var(--vscode-editor-foreground);
          }
          
          h2 {
            font-size: 1.2em;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: var(--vscode-editor-foreground);
          }
          
          .section {
            margin-bottom: 16px;
            padding: 16px;
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-sideBar-border);
            border-radius: 3px;
          }
          
          .form-group {
            margin-bottom: 12px;
          }
          
          label {
            display: block;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--vscode-foreground);
          }
          
          input, select, textarea {
            width: calc(100% - 24px);
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: var(--vscode-font-size);
            color: var(--vscode-input-foreground);
            background-color: var(--vscode-input-background);
            box-sizing: border-box;
          }
          
          input:focus, select:focus, textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
          }
          
          .input-group {
            display: flex;
            gap: 8px;
          }
          
          .input-group input {
            flex: 1;
          }
          
          button {
            padding: 6px 12px;
            border: 1px solid transparent;
            border-radius: 2px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
            font-weight: 600;
            transition: background-color 0.1s ease;
          }
          
          .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          
          .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            min-width: 80px;
            text-align: center;
          }
          
          .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }

          .btn-add {
            width: 100%;
            margin-top: 12px;
          }
          
          .project-config {
            margin-bottom: 16px;
            padding: 12px;
            border: 1px solid var(--vscode-sideBar-border);
            border-radius: 3px;
            border-bottom: 2px solid var(--vscode-sideBar-border);
          }
          
          .alert {
            padding: 8px 12px;
            border-radius: 2px;
            margin-top: 12px;
            display: none;
          }
          
          .alert-danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            border-color: var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
          }
        </style>
      </head>
      <body>
        <h1>Report Generator Configuration</h1>
        
        <div class="section">
          <h2>Project Configurations</h2>
          <div id="projects-container">
            <div class="project-config">
              <div class="form-group">
                <label>Project Name</label>
                <input type="text" class="project-name" placeholder="Enter project name" />
              </div>
              <div class="form-group">
                <label>Project Path</label>
                <div class="input-group">
                  <input type="text" class="project-path" placeholder="Select project folder" readonly />
                  <button class="select-project-path btn-secondary">Browse</button>
                </div>
              </div>
              <button class="remove-project btn-secondary">Remove</button>
            </div>
          </div>
          <button id="add-project" class="btn-secondary btn-add">Add Project</button>
        </div>

        <div class="section">
          <h2>LLM Configuration</h2>
          <div class="form-group">
            <label for="fullURL">full URL</label>
            <input type="text" id="baseURL" placeholder="Enter API full URL" />
          </div>
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input type="password" id="apiKey" placeholder="Enter your API key" />
          </div>
          <div class="form-group">
            <label for="modelId">Model ID</label>
            <input type="text" id="modelId" placeholder="Enter model ID" />
          </div>
        </div>

        <div class="section">
          <h2>Report Configuration</h2>
          <div class="form-group">
            <label for="reportType">Report Type</label>
            <select id="reportType">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="startDate" required />
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input type="date" id="endDate" required />
          </div>
          <div class="form-group">
            <label for="additionalInfo">Additional Information</label>
            <textarea id="additionalInfo" rows="3" placeholder="Enter any additional information"></textarea>
          </div>
        </div>

        <div class="form-group">
          <button id="saveConfig" class="btn-secondary">Save Configuration</button>
          <button id="generateReport" class="btn-primary">Generate Report</button>
        </div>
        <div id="error" class="alert alert-danger" role="alert"></div>

        <script>
          const vscode = acquireVsCodeApi();

          // Initialize with saved configuration
          let currentConfig = {};
          vscode.postMessage({ command: 'loadConfig' });

          // Handle project selection
          document.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-project-path')) {
              const projectDiv = e.target.closest('.project-config');
              vscode.postMessage({ 
                command: 'selectProjectPath',
                projectId: Array.from(document.querySelectorAll('.project-config')).indexOf(projectDiv)
              });
            }
          });

          // Add new project
          document.getElementById('add-project').addEventListener('click', () => {
            const projectDiv = document.createElement('div');
            projectDiv.className = 'project-config';
            projectDiv.innerHTML = 
              '<div class="form-group">' +
                '<label>Project Name</label>' +
                '<input type="text" class="project-name" placeholder="Enter project name" />' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Project Path</label>' +
                '<div class="input-group">' +
                  '<input type="text" class="project-path" placeholder="Select project folder" readonly />' +
                  '<button class="select-project-path btn-secondary">Browse</button>' +
                '</div>' +
              '</div>' +
              '<button class="remove-project btn-secondary">Remove</button>';
            document.getElementById('projects-container').appendChild(projectDiv);
          });

          // Remove project
          document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-project')) {
              e.target.closest('.project-config').remove();
            }
          });

          // Save configuration
          document.getElementById('saveConfig').addEventListener('click', () => {
            const projects = Array.from(document.querySelectorAll('.project-config')).map(project => ({
              name: project.querySelector('.project-name').value,
              path: project.querySelector('.project-path').value
            }));

            const config = {
              projects,
              baseURL: document.getElementById('baseURL').value,
              apiKey: document.getElementById('apiKey').value,
              modelId: document.getElementById('modelId').value,
              reportType: document.getElementById('reportType').value,
              startDate: document.getElementById('startDate').value,
              endDate: document.getElementById('endDate').value,
              additionalInfo: document.getElementById('additionalInfo').value
            };

            vscode.postMessage({ command: 'saveConfig', config });
          });

          document.getElementById('generateReport').addEventListener('click', () => {
            const projects = Array.from(document.querySelectorAll('.project-config')).map(project => ({
              name: project.querySelector('.project-name').value,
              path: project.querySelector('.project-path').value
            }));

            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (new Date(startDate) > new Date(endDate)) {
              const errorDiv = document.getElementById('error');
              errorDiv.textContent = 'Start date must be before end date';
              errorDiv.style.display = 'block';
              return;
            }

            const config = {
              projects,
              baseURL: document.getElementById('baseURL').value,
              apiKey: document.getElementById('apiKey').value,
              modelId: document.getElementById('modelId').value,
              reportType: document.getElementById('reportType').value,
              startDate,
              endDate,
              additionalInfo: document.getElementById('additionalInfo').value
            };

            vscode.postMessage({ command: 'generateReport', config });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'loadConfig') {
              currentConfig = message.config;
              const projectsContainer = document.getElementById('projects-container');
              projectsContainer.innerHTML = '';
              
              if (message.config.projects && message.config.projects.length > 0) {
                message.config.projects.forEach(project => {
                  const projectDiv = document.createElement('div');
                  projectDiv.className = 'project-config';
                  projectDiv.innerHTML = 
                    '<div class="form-group">' +
                      '<label>Project Name</label>' +
                      '<input type="text" class="project-name" value="' + (project.name || '') + '" placeholder="Enter project name" />' +
                    '</div>' +
                    '<div class="form-group">' +
                      '<label>Project Path</label>' +
                      '<div class="input-group">' +
                        '<input type="text" class="project-path" value="' + (project.path || '') + '" placeholder="Select project folder" readonly />' +
                        '<button class="select-project-path btn-secondary">Browse</button>' +
                      '</div>' +
                    '</div>' +
                    '<button class="remove-project btn-secondary">Remove</button>';
                  projectsContainer.appendChild(projectDiv);
                });
              }

              document.getElementById('startDate').value = message.config.startDate || '';
              document.getElementById('endDate').value = message.config.endDate || '';
              document.getElementById('baseURL').value = message.config.baseURL || '';
              document.getElementById('apiKey').value = message.config.apiKey || '';
              document.getElementById('modelId').value = message.config.modelId || '';
              document.getElementById('reportType').value = message.config.reportType || 'daily';
              document.getElementById('timeRange').value = message.config.timeRange || '';
              document.getElementById('additionalInfo').value = message.config.additionalInfo || '';
            } else if (message.command === 'setProjectPath') {
              const projectDiv = document.querySelectorAll('.project-config')[message.projectId];
              if (projectDiv) {
                projectDiv.querySelector('.project-path').value = message.path || '';
              }
            } else if (message.command === 'configSaved') {
              if (message.success) {
                vscode.postMessage({ command: 'loadConfig' });
              } else {
                const errorDiv = document.getElementById('error');
                errorDiv.textContent = message.error || 'Failed to save configuration';
                errorDiv.style.display = 'block';
              }
            } else if (message.command === 'reportResult') {
              const errorDiv = document.getElementById('error');
              if (message.success) {
                errorDiv.style.display = 'none';
                vscode.postMessage({ command: 'showReport', report: message.report });
              } else {
                errorDiv.textContent = message.error || 'Failed to generate report';
                errorDiv.style.display = 'block';
              }
            }
          });
        </script>
      </body>
      </html>`;
  }

  setupMessageHandlers(webviewView: vscode.WebviewView) {
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      switch (message.command) {
        case 'loadConfig':
          const config = this.reportGenerator.getCurrentConfig();
          if (this._view) {
            this._view.webview.postMessage({
              command: 'loadConfig',
              config
            });
          }
          break;

        case 'saveConfig':
          try {
            console.log('Saving config:', message.config);
            // Save the configuration
            await this.reportGenerator.saveConfig(message.config);
            
            // Wait briefly to ensure the configuration is fully persisted
            await new Promise(resolve => setTimeout(resolve, 100));

            //异步提示保存成功
            vscode.window.showInformationMessage('Configuration saved successfully!');
            
            // Get the updated configuration
            // const updatedConfig = this.reportGenerator.getCurrentConfig();

            // console.log('Updated config:', updatedConfig);
            
            // // Verify the configuration was saved correctly
            // if (!updatedConfig.projects || !Array.isArray(updatedConfig.projects)) {
            //   throw new Error('Failed to save projects configuration');
            // }
            
            // // Update the UI with the saved configuration
            // if (this._view) {
            //   this._view.webview.postMessage({
            //     command: 'loadConfig',
            //     config: updatedConfig
            //   });
            // }
          } catch (error) {
            console.error('Failed to save configuration:', error);
            if (this._view) {
              this._view.webview.postMessage({
                command: 'configSaved',
                success: false,
                error: error.message
              });
            }
          }
          break;

        case 'selectProjectPath':
          const path = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
          });
          if (path && this._view) {
            // Update the specific project's path
            const config = this.reportGenerator.getCurrentConfig();
            if (!config.projects) {
              config.projects = [];
            }
            if (!config.projects[message.projectId]) {
              config.projects[message.projectId] = { name: '', path: '' };
            }
            config.projects[message.projectId].path = path[0].fsPath;

            
            // Save the updated config
            // await this.reportGenerator.saveConfig(config);
            
            // Update the UI
            this._view.webview.postMessage({
              command: 'setProjectPath',
              projectId: message.projectId,
              path: path[0].fsPath
            });
          }
          break;

        case 'generateReport':
          try {
            // Validate projects
            if (!message.config.projects || message.config.projects.length === 0) {
              throw new Error('At least one project must be configured');
            }

            // Validate dates
            if (new Date(message.config.startDate) > new Date(message.config.endDate)) {
              throw new Error('Start date must be before end date');
            }

            const report = await this.reportGenerator.generateReport(message.config);
            if (this._view) {
              this._view.webview.postMessage({
                command: 'reportResult',
                success: true,
                report
              });
            }
          } catch (error: any) {
            if (this._view) {
              this._view.webview.postMessage({
                command: 'reportResult',
                success: false,
                error: error.message
              });
            }
          }
          break;

        case 'showReport':
          if (message.report) {
            const doc = await vscode.workspace.openTextDocument({
              content: message.report,
              language: 'markdown'
            });
            vscode.window.showTextDocument(doc);
          }
          break;
      }
    }, undefined, this.context.subscriptions);
  }
}
