package com.airbank.ebank.service;

import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.mapper.MessageMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 消息中心：OTP 通知、交易通知、系统通知（docs/design/05 §3.4）。
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageMapper messageMapper;

    public void notify(Long customerId, String msgType, String title, String content) {
        Message m = new Message();
        m.setCustomerId(customerId);
        m.setMsgType(msgType);
        m.setTitle(title);
        m.setContent(content);
        m.setIsRead(false);
        messageMapper.insert(m);
    }

    public PageResult<Message> page(Long customerId, boolean unreadOnly, int pageNum, int pageSize) {
        LambdaQueryWrapper<Message> qw = new LambdaQueryWrapper<Message>()
                .eq(Message::getCustomerId, customerId)
                .orderByDesc(Message::getId);
        if (unreadOnly) {
            qw.eq(Message::getIsRead, false);
        }
        Page<Message> page = messageMapper.selectPage(new Page<>(pageNum, pageSize), qw);
        List<Message> list = page.getRecords();
        return new PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    public void markRead(Long customerId, Long id) {
        Message m = messageMapper.selectById(id);
        if (m == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "消息不存在");
        }
        requireOwner(customerId, m.getCustomerId());
        m.setIsRead(true);
        messageMapper.updateById(m);
    }

    private void requireOwner(Long customerId, Long ownerCustomerId) {
        if (!customerId.equals(ownerCustomerId)) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "非本人消息，禁止操作");
        }
    }
}
