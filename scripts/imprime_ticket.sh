#!/bin/bash

cp scripts/impressao.zpl scripts/tmp.zpl

SUBJECT=3a
SEARCH_FOR=%1
REPLACE_WITH=$1

echo "$SUBJECT" | sed -e "s/$SEARCH_FOR/$REPLACE_WITH/g" scripts/tmp.zpl > scripts/tmp.zpl

lpr -P Zebra_Technologies_ZTC_GC420t_ -o raw scripts/tmp1.zpl
