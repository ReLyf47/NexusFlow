import * as React from 'react';
import { Linking, View } from 'react-native';
import { Txt } from '@/components/ui';
import { parseMarkdown, type Inline } from '@/lib/markdown';
import { fonts, useTheme } from '@/lib/theme';

export function MarkdownView({ content, onWikiLink }: { content: string; onWikiLink: (title: string) => void }) {
  const { t } = useTheme();
  const blocks = React.useMemo(() => parseMarkdown(content), [content]);

  const inline = (parts: Inline[]) =>
    parts.map((p, i) => {
      switch (p.kind) {
        case 'bold':
          return <Txt key={i} variant="bodyBold">{p.text}</Txt>;
        case 'italic':
          return <Txt key={i} style={{ fontStyle: 'italic' }}>{p.text}</Txt>;
        case 'code':
          return <Txt key={i} style={{ fontFamily: fonts.mono, fontSize: 13, backgroundColor: t.elevated }}>{` ${p.text} `}</Txt>;
        case 'wiki':
          return (
            <Txt key={i} accessibilityRole="link" onPress={() => onWikiLink(p.title)} style={{ fontFamily: fonts.monoBold, fontSize: 14, backgroundColor: t.elevated }}>
              <Txt style={{ fontFamily: fonts.monoBold, fontSize: 14 }} color={t.cyan}>[[</Txt>
              {p.title}
              <Txt style={{ fontFamily: fonts.monoBold, fontSize: 14 }} color={t.cyan}>]]</Txt>
            </Txt>
          );
        case 'link':
          return (
            <Txt key={i} accessibilityRole="link" onPress={() => Linking.openURL(p.url)} style={{ textDecorationLine: 'underline', textDecorationColor: t.pink }}>
              {p.text}
            </Txt>
          );
        default:
          return p.text;
      }
    });

  if (!content.trim()) return <Txt variant="mono">Dokumen kosong. Ketuk EDIT untuk mulai menulis Markdown.</Txt>;

  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <View key={i} style={b.level <= 2 ? { borderBottomWidth: 2, borderColor: t.border, paddingBottom: 4, marginTop: 8 } : { marginTop: 6 }}>
                <Txt variant={b.level <= 2 ? 'h2' : 'bodyBold'}>{inline(b.inline)}</Txt>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                    <Txt variant="monoBold" color={t.pink} style={{ fontSize: 14, lineHeight: 25 }}>
                      {it.checked === null ? (b.ordered ? `${j + 1}.` : '■') : it.checked ? '☑' : '☐'}
                    </Txt>
                    <Txt style={{ flex: 1 }}>{inline(it.inline)}</Txt>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View key={i} style={{ borderLeftWidth: 4, borderColor: t.pink, paddingLeft: 12 }}>
                <Txt color={t.sub} style={{ fontStyle: 'italic' }}>{inline(b.inline)}</Txt>
              </View>
            );
          case 'code':
            return (
              <View key={i} style={{ borderWidth: 2.5, borderColor: t.border, backgroundColor: t.elevated, padding: 12 }}>
                <Txt style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 }}>{b.text}</Txt>
              </View>
            );
          case 'table':
            return (
              <View key={i} style={{ borderWidth: 2, borderColor: t.border }}>
                {b.rows.map((row, r) => (
                  <View key={r} style={{ flexDirection: 'row', borderTopWidth: r ? 2 : 0, borderColor: t.border, backgroundColor: r === 0 ? t.elevated : undefined }}>
                    {row.map((cell, c) => (
                      <View key={c} style={{ flex: c === 0 ? 2 : 1, padding: 6, borderLeftWidth: c ? 2 : 0, borderColor: t.border }}>
                        <Txt style={{ fontFamily: r === 0 ? fonts.monoBold : fonts.body, fontSize: 12, lineHeight: 17 }}>{inline(cell)}</Txt>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'rule':
            return <View key={i} style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.border }} />;
          default:
            return <Txt key={i}>{inline(b.inline)}</Txt>;
        }
      })}
    </View>
  );
}
