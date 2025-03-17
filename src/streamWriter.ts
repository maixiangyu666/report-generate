import * as vscode from 'vscode';
export class StreamWriter {
    private editor: vscode.TextEditor | undefined;
    private contentBuffer: string[] = [];
    private isWriting = false;
    private lastPosition: vscode.Position | undefined;
  
    // 初始化编辑器文档
    async prepareEditor() {
  
    //  let editor = vscode.window.activeTextEditor;
    //   if (!editor) {
        // Create new document if no active editor exists
        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown'
        });
        this.editor  = await vscode.window.showTextDocument(doc);
      // }
  
     this.lastPosition = new vscode.Position(0, 0);
      
    }

   // 流式写入主逻辑
    async writeStream(content: string): Promise<void> {
        this.contentBuffer.push(content);
        
        if (!this.isWriting) {
        return this.processBuffer(this.editor);
        }
    }

    // 带锁的缓冲区处理
    private async processBuffer(editor: vscode.TextEditor) {
        this.isWriting = true;
        
        try {
          while (this.contentBuffer.length > 0) {
            const content = this.contentBuffer.shift();
            if (!content) {continue;}
            
            await editor.edit(editBuilder => {
              if (!this.lastPosition) {return;}
              
              // Format markdown content
              let formattedContent = content.trimEnd();
              
              // Only add spacing if content is a header or list
              // if (content.startsWith('#') || content.startsWith('- ')) {
              //   if (!this.lastPosition?.isEqual(new vscode.Position(0, 0))) {
              //     editBuilder.insert(this.lastPosition, '\n');
              //     this.lastPosition = this.lastPosition.translate(1);
              //   }
              // }
              
              // Insert content without adding extra symbols
              editBuilder.insert(this.lastPosition, formattedContent);
              

              this.lastPosition = this.lastPosition.translate(1);
            });
            
            this.autoScroll(editor);
          }
        } finally {
          this.isWriting = false;
        }
    }

      
    // 自动滚动到末尾
    private autoScroll(editor: vscode.TextEditor) {
        if (this.lastPosition) {
        const range = new vscode.Range(this.lastPosition, this.lastPosition);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
 

    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}
