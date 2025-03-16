# Report Generate Extension for VS Code

The Report Generate extension provides a powerful toolset for creating and managing reports directly within Visual Studio Code. It supports multiple report types, data sources, and output formats, making it an essential tool for developers and data analysts.







## Features

- **Multiple Report Types**: Generate Daily, Weekly, and Monthly reports
- **Flexible Data Sources**: Connect to various data sources including databases, APIs, and local files
- **Customizable Output**: Export reports in PDF, HTML, and Markdown formats
- **Interactive Configuration**: User-friendly configuration panel for setting report parameters
- **Report Management**: View, regenerate, and delete previous reports
- **VS Code Integration**: Seamless integration with VS Code's UI and command palette

## Usage

To generate reports using the report-generate extension:

1. Open the Report Configuration Panel:
   - Click the report icon in the VS Code Activity Bar
   - Or use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P on macOS) and search for "Report Generate: Open Configuration"

2. Configure Report Settings:
   - In the configuration panel, set up your report parameters:
     * Select report type (Daily/Weekly/Monthly)
     * Choose data sources
     * Set date range
     * Configure output format (PDF/HTML/Markdown)
   - All changes are automatically saved

3. Generate Report:
   - Click the "Generate Report" button in the configuration panel
   - The extension will:
     * Process your configuration
     * Generate the report
     * Open it in a new editor tab
   - The generated report will be saved in your workspace's "reports" folder

4. (Optional) Manage Reports:
   - Use the "Recent Reports" section in the configuration panel to:
     * View previously generated reports
     * Regenerate reports with updated settings
     * Delete old reports

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

- Visual Studio Code 1.75.0 or higher
- Node.js 16.x or higher (for extension development)
- npm 8.x or higher

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for "Report Generate"
4. Click Install
5. Reload VS Code when prompted

## Extension Settings

This extension contributes the following settings:

* `reportGenerator.startDate`: Start date for report generation (string)
* `reportGenerator.endDate`: End date for report generation (string)
* `reportGenerator.baseURL`: Base URL for API requests (string)
* `reportGenerator.modelId`: Model ID for AI generation (string)
* `reportGenerator.timeRange`: Time range for report generation (string)
* `reportGenerator.additionalInfo`: Additional information for reports (string)
* `reportGenerator.reportType`: Type of report to generate (enum: daily, weekly, monthly)
* `reportGenerator.projects`: List of projects with their paths (array of objects)
* `reportGenerator.aiModel`: AI model to use for report generation (enum: deepseek, openai, custom)
* `reportGenerator.apiKey`: API key for the selected AI model (string)
* `reportGenerator.dailyReportTime`: Time to generate daily report (HH:mm format)
* `reportGenerator.weeklyReportDay`: Day to generate weekly report (enum: Monday-Sunday)
* `reportGenerator.monthlyReportDay`: Day of month to generate monthly report (number, 1-28)

## Known Issues

- Large reports may cause performance issues in VS Code
- PDF generation requires system-level PDF viewer
- Some data sources may require additional configuration

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes
4. Write tests for your changes
5. Submit a pull request

Please ensure your code follows our coding standards and includes appropriate documentation.

## Repository

The source code for this extension is available on GitHub:  
https://github.com/maixiangyu666/report-generate.git

## License

This extension is licensed under the MIT License. See the [LICENSE](https://github.com/maixiangyu666/report-generate/blob/main/LICENSE) file for details.
