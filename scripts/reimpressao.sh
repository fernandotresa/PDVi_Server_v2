#!/bin/bash

cd scripts
cp reimpressao.zpl tmp.zpl



SUBJECT=3a

TICKET_TYPE_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N")
SEARCH_FOR_TICKET_TYPE=%1
REPLACE_WITH_TICKET_TYPE=$1

VALUE_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N").zpl
SEARCH_FOR_VALUE=%2
REPLACE_WITH_VALUE=$2

OP_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N").zpl
SEARCH_FOR_OP=%3
REPLACE_WITH_OP=$3

DATE_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N").zpl
SEARCH_FOR_DATE=%4
REPLACE_WITH_DATE=$4

TICKET_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N").zpl
SEARCH_FOR_TICKET=%5
REPLACE_WITH_TICKET=$5

TOTAL_FILENAME=tmp$(date "+%Y%m%d%H%M%S%N").zpl
SEARCH_FOR_TOTAL=%6
REPLACE_WITH_TOTAL=$6

touch $TICKET_TYPE_FILENAME
touch $VALUE_FILENAME
touch $OP_FILENAME
touch $DATE_FILENAME
touch $TICKET_FILENAME
touch $TOTAL_FILENAME


echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TICKET_TYPE/$REPLACE_WITH_TICKET_TYPE/g" tmp.zpl > $TICKET_TYPE_FILENAME &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_VALUE/$REPLACE_WITH_VALUE/g" $TICKET_TYPE_FILENAME > $VALUE_FILENAME &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_OP/$REPLACE_WITH_OP/g" $VALUE_FILENAME > $OP_FILENAME &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_DATE/$REPLACE_WITH_DATE/g" $OP_FILENAME > $DATE_FILENAME &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TICKET/$REPLACE_WITH_TICKET/g" $DATE_FILENAME > $TICKET_FILENAME &&
echo "$SUBJECT" | sed -e "s/$SEARCH_FOR_TOTAL/$REPLACE_WITH_TOTAL/g" $TICKET_FILENAME > $TOTAL_FILENAME &&

lpr -P Zebra_Technologies_ZTC_GC420t_ -o raw $TOTAL_FILENAME

rm $TICKET_TYPE_FILENAME
rm $VALUE_FILENAME
rm $OP_FILENAME
rm $DATE_FILENAME
rm $TICKET_FILENAME
rm $TOTAL_FILENAME