#!/bin/bash

cd scripts
cp impressao.zpl tmp.zpl

SUBJECT=3a

SEARCH_FOR_TICKET_TYPE=%1
REPLACE_WITH_TICKET_TYPE=$1

SEARCH_FOR_VALUE=%2
REPLACE_WITH_VALUE=$2

SEARCH_FOR_OP=%3
REPLACE_WITH_OP=$3

SEARCH_FOR_DATE=%4
REPLACE_WITH_DATE=$4

SEARCH_FOR_TICKET=%5
REPLACE_WITH_TICKET=$5

SEARCH_FOR_TOTAL=%6
REPLACE_WITH_TOTAL=$6

echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TICKET_TYPE/$REPLACE_WITH_TICKET_TYPE/g" tmp.zpl > tmp1.zpl &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_VALUE/$REPLACE_WITH_VALUE/g" tmp1.zpl > tmp2.zpl &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_OP/$REPLACE_WITH_OP/g" tmp2.zpl > tmp3.zpl &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_DATE/$REPLACE_WITH_DATE/g" tmp3.zpl > tmp4.zpl &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TICKET/$REPLACE_WITH_TICKET/g" tmp4.zpl > tmp5.zpl &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TOTAL/$REPLACE_WITH_TOTAL/g" tmp5.zpl > tmp6.zpl &&

lpr -P Zebra_Technologies_ZTC_GC420t_ -o raw tmp6.zpl &&
sleep 0.2
rm tmp*.zpl
