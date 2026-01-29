import React from "react";
import { Row, Col, type RowProps }  from 'antd';
 
function Layout({ children, ...props }: RowProps) {
  return (
    <Row justify="space-around" {...props}>
      <Col xs={22} sm={20} md={18} lg={16} xl={14} xxl={12}>
        {children}
      </Col> 
    </Row>
  );
}

export default Layout;