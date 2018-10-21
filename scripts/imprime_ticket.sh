#!/bin/bash

cd scripts
cp impressao.zpl tmp.zpl

SUBJECT=3a
SEARCH_FOR=%1
REPLACE_WITH=$1

echo "$SUBJECT" | sed -e "s/$SEARCH_FOR/$REPLACE_WITH/g" tmp.zpl > tmp1.zpl

lpr -P Zebra_Technologies_ZTC_GC420t_ -o raw tmp1.zpl

rm tmp.zpl
rm tmp1.zpl
