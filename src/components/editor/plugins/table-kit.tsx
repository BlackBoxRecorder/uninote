'use client';

import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from '@platejs/table/react';

import {
  TableCellElement,
  TableCellHeaderElement,
  TableElement,
  TableRowElement,
} from '@/components/ui/table-node';

export const TableKit = [
  TablePlugin.configure({
    options: {
      initialTableWidth: 600,
    },
  }).withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),
];
