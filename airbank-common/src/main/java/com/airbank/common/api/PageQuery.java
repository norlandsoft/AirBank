package com.airbank.common.api;

import lombok.Data;

@Data
public class PageQuery {

    private int pageNum = 1;
    private int pageSize = 20;

    public int pageNum() {
        return Math.max(1, pageNum);
    }

    public int pageSize() {
        return Math.min(200, Math.max(1, pageSize));
    }

    public int offset() {
        return (pageNum() - 1) * pageSize();
    }
}
