import React  from "react";
import { Layout, Tabs} from "antd"
import Chat, { Bubble, useMessages } from '@chatui/core';
import type { MessageProps } from '@chatui/core';
// 引入样式
import '@chatui/core/dist/index.css'

function AIComponent() {
    const { messages, appendMsg } = useMessages([]);
    function handleSend(type: string, val:string) {
      if (type === 'text' && val.trim()) {
        appendMsg({
          type: 'text',
          content: { text: val },
          position: 'right',
        });

        setTimeout(() => {
          appendMsg({
            type: 'text',
            content: { text: 'Bala bala' },
          });
        }, 1000);
      }
    }
  
    function renderMessageContent(msg:MessageProps) {
      const { content } = msg;
      return <Bubble content={content.text} />;
    }
  
  return (
    <Layout style={{height: "100vh"}}>
            {/* 侧边栏内容 ai chat聊天列表*/}
            <Tabs
                tabPlacement="start"
                type="editable-card"
                items={[
                    {
                        key: '1',
                        label: `聊天列表`,
                        children: 
                        <Chat
                            navbar={{ title: '智能助理' }}
                            messages={messages}
                            renderMessageContent={renderMessageContent}
                            onSend={handleSend}       
                        />,
                    },
                    {
                        key: '2',
                        label: `设置`,
                        children: <div>设置内容</div>,
                    },
                ]}
            />
      
    </Layout>
  );
}

export default AIComponent;