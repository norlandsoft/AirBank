package com.airbank.common.api;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.io.Serializable;
import java.util.List;

@Getter
@AllArgsConstructor
public class PageResult<T> implements Serializable {

    private final List<T> list;
    private final long total;
    private final int pageNum;
    private final int pageSize;
}
