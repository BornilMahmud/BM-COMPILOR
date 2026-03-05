#include <stdio.h>
#include <string.h>
#include "util.h"

void json_escape(char *dest, const char *src, int max_len) {
    int j = 0;
    for (int i = 0; src[i] && j < max_len - 6; i++) {
        switch (src[i]) {
            case '"':  dest[j++] = '\\'; dest[j++] = '"'; break;
            case '\\': dest[j++] = '\\'; dest[j++] = '\\'; break;
            case '\n': dest[j++] = '\\'; dest[j++] = 'n'; break;
            case '\r': dest[j++] = '\\'; dest[j++] = 'r'; break;
            case '\t': dest[j++] = '\\'; dest[j++] = 't'; break;
            default:
                if ((unsigned char)src[i] < 0x20) {
                    j += snprintf(dest + j, max_len - j, "\\u%04x", (unsigned char)src[i]);
                } else {
                    dest[j++] = src[i];
                }
        }
    }
    dest[j] = '\0';
}
