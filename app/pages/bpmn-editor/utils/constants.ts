import type { CSSProperties } from 'react';

/** BPMN.js 容器样式：确保左侧 palette 工具栏完整显示 */
export const containerStyle: CSSProperties = {
    height: '65vh',
    minHeight: 500,
    position: 'relative',
    background: '#f8f9fa',
};

/** 默认空流程模板 */
export const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** 预置模板 */
export const TEMPLATES: Record<string, string> = {
    'simple-approval': `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="ApprovalProcess" name="简单审批流程" isExecutable="true">
    <bpmn:startEvent id="start" name="提交申请">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="leader_approve" name="直属领导审批">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="gateway1" name="是否通过">
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
      <bpmn:outgoing>flow4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="notify" name="发送通知">
      <bpmn:incoming>flow3</bpmn:incoming>
      <bpmn:outgoing>flow5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end_approve" name="审批完成">
      <bpmn:incoming>flow5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="end_reject" name="已拒绝">
      <bpmn:incoming>flow4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="leader_approve" />
    <bpmn:sequenceFlow id="flow2" sourceRef="leader_approve" targetRef="gateway1" />
    <bpmn:sequenceFlow id="flow3" name="通过" sourceRef="gateway1" targetRef="notify">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">approved == true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow4" name="拒绝" sourceRef="gateway1" targetRef="end_reject">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">approved == false</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow5" sourceRef="notify" targetRef="end_approve" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="ApprovalProcess">
      <bpmndi:BPMNShape id="shape_start" bpmnElement="start">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_leader" bpmnElement="leader_approve">
        <dc:Bounds x="270" y="137" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_gateway" bpmnElement="gateway1" isMarkerVisible="true">
        <dc:Bounds x="425" y="152" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_notify" bpmnElement="notify">
        <dc:Bounds x="530" y="137" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_ok" bpmnElement="end_approve">
        <dc:Bounds x="692" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_reject" bpmnElement="end_reject">
        <dc:Bounds x="452" y="279" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="edge_flow1" bpmnElement="flow1">
        <di:waypoint x="215" y="177" />
        <di:waypoint x="270" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow2" bpmnElement="flow2">
        <di:waypoint x="370" y="177" />
        <di:waypoint x="425" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow3" bpmnElement="flow3">
        <di:waypoint x="475" y="177" />
        <di:waypoint x="530" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow5" bpmnElement="flow5">
        <di:waypoint x="630" y="177" />
        <di:waypoint x="692" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow4" bpmnElement="flow4">
        <di:waypoint x="450" y="202" />
        <di:waypoint x="450" y="279" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
};
