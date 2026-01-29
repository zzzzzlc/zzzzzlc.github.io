import React  from "react";
import { Layout } from "antd"
import Sider from "antd/es/layout/Sider";
import { Content } from "antd/es/layout/layout";
import Chat, { MessageProps } from "@chatui/core";

function AIComponent() {
    const handleSend = (type: string, content: string) => {
        console.log("发送消息:", type, content);
    }
  return (
    <Layout>
        <Sider>
            {/* 侧边栏内容 ai chat聊天列表*/}
        </Sider>
        <Content>
            {/* 主要内容 ai chat聊天窗口*/}
            <Chat
                onSend={handleSend} 
                messages={[]} 
                renderMessageContent={(message: MessageProps): React.ReactNode =>{
                    throw new Error("Function not implemented.")
                } }            
            />
        </Content>
    </Layout>
  );
}

export default AIComponent;