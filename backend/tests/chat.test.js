process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('../config/env').loadEnv();
const { assertSafeTestDatabase } = require('./test-db-guard');
assertSafeTestDatabase();

const { app } = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const FileAsset = require('../models/FileAsset');
const Notification = require('../models/Notification');
const WorkflowEvent = require('../models/WorkflowEvent');

const TEST_PORT = 5011;

const loginActor = async (email, password) => {
  const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await res.json();
  if (!result.success || !result.data.accessToken) {
    throw new Error(`Failed login for ${email}`);
  }
  return result.data.accessToken;
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const runIntegrationTests = async () => {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\nTemporary chat integration test server listening on port ${TEST_PORT}...`);

    try {
      console.log('\n--- Test 0: Preparing chat actors and room ---');
      const studentUser = await User.findOne({ email: 'hoanganh@hust.edu.vn' });
      const lecturerUser = await User.findOne({ email: 'haikt@hust.edu.vn' });
      const outsiderUser = await User.findOne({ email: 'hongnt@hust.edu.vn' });
      if (!studentUser || !lecturerUser || !outsiderUser) {
        throw new Error('Required chat test users are missing.');
      }

      const prisma = require('../config/prisma');
      await prisma.chatMessage.deleteMany({});
      await prisma.chatRoomMember.deleteMany({});
      await prisma.chatRoom.deleteMany({});
      await prisma.workflowEvent.deleteMany({ where: { entityType: 'ChatRoom' } });

      await ChatRoom.deleteMany({ name: 'Chat Attachment Test Room' });
      await ChatMessage.deleteMany({ body: /CHAT_TEST_/ });
      await FileAsset.deleteMany({ ownerType: 'chat_room' });
      await Notification.deleteMany({ type: 'CHAT_MESSAGE' });
      await WorkflowEvent.deleteMany({ entityType: 'ChatRoom' });

      const roomId = new mongoose.Types.ObjectId().toString();
      const now = new Date();

      await prisma.chatRoom.create({
        data: {
          id: roomId,
          mongoId: roomId,
          type: 'direct',
          name: 'Chat Attachment Test Room',
          status: 'accepted',
          requestedBy: studentUser._id.toString(),
          acceptedBy: lecturerUser._id.toString(),
          acceptedAt: now,
          createdAt: now,
          updatedAt: now
        }
      });

      await prisma.chatRoomMember.create({
        data: {
          roomId,
          userId: studentUser._id.toString(),
          role: 'member',
          status: 'active',
          joinedAt: now
        }
      });

      await prisma.chatRoomMember.create({
        data: {
          roomId,
          userId: lecturerUser._id.toString(),
          role: 'teacher',
          status: 'accepted',
          joinedAt: now
        }
      });

      const room = await ChatRoom.create({
        _id: roomId,
        type: 'direct',
        name: 'Chat Attachment Test Room',
        status: 'accepted',
        memberIds: [studentUser._id, lecturerUser._id],
        requestedBy: studentUser._id,
        acceptedBy: lecturerUser._id,
        acceptedAt: now,
      });
      console.log(`Created test direct room: ${room._id}`);

      const tokenStudent = await loginActor('hoanganh@hust.edu.vn', 'password123');
      const tokenLecturer = await loginActor('haikt@hust.edu.vn', 'password123');
      const tokenOutsider = await loginActor('hongnt@hust.edu.vn', 'password123');
      console.log('Logged in chat test actors.');

      console.log('\n--- Test 1: Send text message and unread count ---');
      const textRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms/${room._id}/messages`, {
        method: 'POST',
        headers: authHeaders(tokenStudent),
        body: JSON.stringify({ body: 'CHAT_TEST_text_message' }),
      });
      const textResult = await textRes.json();
      if (textRes.status !== 201 || !textResult.success || textResult.data.body !== 'CHAT_TEST_text_message') {
        throw new Error(`Text send failed: ${textResult.message}`);
      }

      const roomsBeforeReadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms`, {
        headers: { Authorization: `Bearer ${tokenLecturer}` },
      });
      const roomsBeforeRead = await roomsBeforeReadRes.json();
      const lecturerRoomBeforeRead = roomsBeforeRead.data.find((item) => String(item._id) === String(room._id));
      if (!lecturerRoomBeforeRead || lecturerRoomBeforeRead.unreadCount < 1) {
        throw new Error('Unread count did not increase for recipient.');
      }
      console.log('Text message and unread count passed.');

      console.log('\n--- Test 2: Mark room as read ---');
      const readRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms/${room._id}/read`, {
        method: 'POST',
        headers: authHeaders(tokenLecturer),
        body: '{}',
      });
      const readResult = await readRes.json();
      if (!readResult.success) {
        throw new Error(`Mark read failed: ${readResult.message}`);
      }
      const roomsAfterReadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms`, {
        headers: { Authorization: `Bearer ${tokenLecturer}` },
      });
      const roomsAfterRead = await roomsAfterReadRes.json();
      const lecturerRoomAfterRead = roomsAfterRead.data.find((item) => String(item._id) === String(room._id));
      if (lecturerRoomAfterRead.unreadCount !== 0) {
        throw new Error('Unread count did not reset after mark read.');
      }
      console.log('Mark read passed.');

      console.log('\n--- Test 3: Upload image attachment-only message ---');
      const pngBytes = Buffer.concat([
        Buffer.from('89504E47', 'hex'),
        Buffer.from('CHAT_TEST_png_payload'),
      ]);
      const formData = new FormData();
      formData.append('file', new Blob([pngBytes], { type: 'image/png' }), 'CHAT_TEST_image.png');
      formData.append('body', '');
      const uploadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms/${room._id}/messages/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenStudent}` },
        body: formData,
      });
      const uploadResult = await uploadRes.json();
      if (uploadRes.status !== 201 || !uploadResult.success || uploadResult.data.attachments.length !== 1) {
        throw new Error(`Attachment upload failed: ${uploadResult.message}`);
      }
      const attachmentMessageId = uploadResult.data._id;
      const fileId = uploadResult.data.attachments[0].fileId._id || uploadResult.data.attachments[0].fileId;
      console.log(`Attachment message created: ${attachmentMessageId}`);

      console.log('\n--- Test 4: Chat file scoped download permissions ---');
      const allowedDownloadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/${fileId}/download-url`, {
        headers: { Authorization: `Bearer ${tokenLecturer}` },
      });
      if (allowedDownloadRes.status !== 200) {
        throw new Error('Room member could not create download URL.');
      }
      const deniedDownloadRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/files/${fileId}/download-url`, {
        headers: { Authorization: `Bearer ${tokenOutsider}` },
      });
      if (deniedDownloadRes.status !== 403) {
        throw new Error('Outsider was allowed to create chat file download URL.');
      }
      console.log('Chat file access checks passed.');

      console.log('\n--- Test 5: Notifications and audit events ---');
      const chatNotification = await prisma.notification.findFirst({
        where: {
          recipientId: lecturerUser._id.toString(),
          type: 'CHAT_MESSAGE',
          entityId: room._id.toString(),
          isDeleted: false,
        }
      });
      if (!chatNotification) {
        throw new Error('Chat notification was not created for recipient.');
      }
       const uploadAudit = await prisma.workflowEvent.findFirst({
        where: {
          entityType: 'ChatRoom',
          entityId: room._id.toString(),
          action: 'CHAT_SEND_ATTACHMENT',
        }
      });
      if (!uploadAudit) {
        throw new Error('Attachment audit event was not created.');
      }
      console.log('Notification and attachment audit passed.');

      console.log('\n--- Test 6: Recall own message and block others ---');
      const badDeleteRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms/${room._id}/messages/${attachmentMessageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenLecturer}` },
      });
      if (badDeleteRes.status !== 403) {
        throw new Error('Recipient was allowed to recall sender message.');
      }

      const deleteRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/chat/rooms/${room._id}/messages/${attachmentMessageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStudent}` },
      });
      const deleteResult = await deleteRes.json();
      if (deleteRes.status !== 200 || !deleteResult.success) {
        throw new Error(`Sender recall failed: ${deleteResult.message}`);
      }
      const deletedMessage = await prisma.chatMessage.findUnique({
        where: { id: attachmentMessageId }
      });
      if (!deletedMessage?.isDeleted || !deletedMessage.deletedAt || String(deletedMessage.deletedBy) !== String(studentUser._id)) {
        throw new Error('Message was not soft-deleted correctly.');
      }
      const recallAudit = await prisma.workflowEvent.findFirst({
        where: {
          entityType: 'ChatRoom',
          entityId: room._id.toString(),
          action: 'CHAT_RECALL_MESSAGE',
        }
      });
      if (!recallAudit) {
        throw new Error('Recall audit event was not created.');
      }
      console.log('Recall permissions and soft delete passed.');

      console.log('\nAll chat integration tests passed.');
    } catch (error) {
      console.error('\nChat integration test failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exitCode = 1;
    } finally {
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(process.exitCode || 0);
      });
    }
  });
};

runIntegrationTests();
