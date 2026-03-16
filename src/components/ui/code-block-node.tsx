'use client';

import { formatCodeBlock, isLangSupported } from '@platejs/code-block';
import { BracesIcon, Check, CheckIcon, ChevronDown, ChevronRight, CopyIcon, Maximize2, X } from 'lucide-react';
import { NodeApi, type TCodeBlockElement, type TCodeSyntaxLeaf } from 'platejs';
import {
  PlateElement,
  type PlateElementProps,
  PlateLeaf,
  type PlateLeafProps,
  useEditorRef,
  useElement,
  useReadOnly,
} from 'platejs/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function CodeBlockElement(props: PlateElementProps<TCodeBlockElement>) {
  const { editor, element } = props;
  const [collapsed, setCollapsed] = React.useState(element.collapsed ?? false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    editor.tf.setNodes<TCodeBlockElement>(
      { collapsed: newCollapsed },
      { at: element }
    );
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  const codeContent = React.useMemo(() => NodeApi.string(element), [element]);

  return (
    <>
      <PlateElement
        className="py-1"
        {...props}
      >
        <div className="relative rounded-md bg-muted/50">
          <div 
            className={cn(
              "flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/80 rounded-t-md",
              !collapsed && "rounded-b-none"
            )}
            contentEditable={false}
          >
            <Button
              className="h-6 px-1 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={toggleCollapse}
              size="sm"
              variant="ghost"
            >
              {collapsed ? (
                <ChevronRight className="!size-3.5" />
              ) : (
                <ChevronDown className="!size-3.5" />
              )}
              <span className="text-xs">代码块</span>
            </Button>
            
            {!collapsed && (
              <div className="flex items-center gap-0.5">
                <Button
                  className="size-6 text-xs"
                  onClick={openFullscreen}
                  size="icon"
                  title="全屏查看"
                  variant="ghost"
                >
                  <Maximize2 className="!size-3.5 text-muted-foreground" />
                </Button>

                {isLangSupported(element.lang) && (
                  <Button
                    className="size-6 text-xs"
                    onClick={() => formatCodeBlock(editor, { element })}
                    size="icon"
                    title="Format code"
                    variant="ghost"
                  >
                    <BracesIcon className="!size-3.5 text-muted-foreground" />
                  </Button>
                )}

                <CodeBlockCombobox />

                <CopyButton
                  className="size-6 gap-1 text-muted-foreground text-xs"
                  size="icon"
                  value={() => NodeApi.string(element)}
                  variant="ghost"
                />
              </div>
            )}
          </div>

          {!collapsed && (
            <pre className="overflow-x-auto p-4 pr-4 font-mono text-sm leading-[normal] [tab-size:2] print:break-inside-avoid">
              <code>{props.children}</code>
            </pre>
          )}
          
          {collapsed && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              {NodeApi.string(element).slice(0, 50)}
              {NodeApi.string(element).length > 50 ? '...' : ''}
            </div>
          )}
        </div>
      </PlateElement>

      {/* 全屏遮罩 */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onDoubleClick={closeFullscreen}
        >
          {/* 遮罩头部工具栏 */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm font-medium">代码预览</span>
              <span className="text-xs text-white/50">
                {element.lang || 'plaintext'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton
                className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                size="icon"
                value={codeContent}
                variant="ghost"
              />
              <Button
                className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={closeFullscreen}
                size="icon"
                variant="ghost"
              >
                <X className="!size-4" />
              </Button>
            </div>
          </div>

          {/* 代码内容区域 */}
          <div className="flex-1 overflow-auto p-8">
            <pre className="min-h-full font-mono text-sm leading-relaxed [tab-size:2]">
              <code className="text-white/90">
                {props.children}
              </code>
            </pre>
          </div>

          {/* 底部提示 */}
          <div className="px-4 py-2 text-center text-xs text-white/40 border-t border-white/10">
            双击任意位置退出全屏
          </div>
        </div>
      )}
    </>
  );
}

function CodeBlockCombobox() {
  const [open, setOpen] = React.useState(false);
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const element = useElement<TCodeBlockElement>();
  const value = element.lang || 'plaintext';
  const [searchValue, setSearchValue] = React.useState('');

  const items = React.useMemo(
    () =>
      languages.filter(
        (language) =>
          !searchValue ||
          language.label.toLowerCase().includes(searchValue.toLowerCase())
      ),
    [searchValue]
  );

  if (readOnly) return null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-6 select-none justify-between gap-1 px-2 text-muted-foreground text-xs"
          role="combobox"
          size="sm"
          variant="ghost"
        >
          {languages.find((language) => language.value === value)?.label ??
            'Plain Text'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        onCloseAutoFocus={() => setSearchValue('')}
      >
        <Command shouldFilter={false}>
          <CommandInput
            className="h-9"
            onValueChange={(value) => setSearchValue(value)}
            placeholder="Search language..."
            value={searchValue}
          />
          <CommandEmpty>No language found.</CommandEmpty>

          <CommandList className="h-[344px] overflow-y-auto">
            <CommandGroup>
              {items.map((language) => (
                <CommandItem
                  className="cursor-pointer"
                  key={language.label}
                  onSelect={(value) => {
                    editor.tf.setNodes<TCodeBlockElement>(
                      { lang: value },
                      { at: element }
                    );
                    setSearchValue(value);
                    setOpen(false);
                  }}
                  value={language.value}
                >
                  <Check
                    className={cn(
                      value === language.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {language.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({
  value,
  ...props
}: { value: (() => string) | string } & Omit<
  React.ComponentProps<typeof Button>,
  'value'
>) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  return (
    <Button
      onClick={() => {
        void navigator.clipboard.writeText(
          typeof value === 'function' ? value() : value
        );
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? (
        <CheckIcon className="!size-3" />
      ) : (
        <CopyIcon className="!size-3" />
      )}
    </Button>
  );
}

export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} />;
}

export function CodeSyntaxLeaf(props: PlateLeafProps<TCodeSyntaxLeaf>) {
  const tokenClassName = props.leaf.className as string;

  return <PlateLeaf className={tokenClassName} {...props} />;
}

const languages: { label: string; value: string }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'ABAP', value: 'abap' },
  { label: 'Agda', value: 'agda' },
  { label: 'Arduino', value: 'arduino' },
  { label: 'ASCII Art', value: 'ascii' },
  { label: 'Assembly', value: 'x86asm' },
  { label: 'Bash', value: 'bash' },
  { label: 'BASIC', value: 'basic' },
  { label: 'BNF', value: 'bnf' },
  { label: 'C', value: 'c' },
  { label: 'C#', value: 'csharp' },
  { label: 'C++', value: 'cpp' },
  { label: 'Clojure', value: 'clojure' },
  { label: 'CoffeeScript', value: 'coffeescript' },
  { label: 'Coq', value: 'coq' },
  { label: 'CSS', value: 'css' },
  { label: 'Dart', value: 'dart' },
  { label: 'Dhall', value: 'dhall' },
  { label: 'Diff', value: 'diff' },
  { label: 'Docker', value: 'dockerfile' },
  { label: 'EBNF', value: 'ebnf' },
  { label: 'Elixir', value: 'elixir' },
  { label: 'Elm', value: 'elm' },
  { label: 'Erlang', value: 'erlang' },
  { label: 'F#', value: 'fsharp' },
  { label: 'Flow', value: 'flow' },
  { label: 'Fortran', value: 'fortran' },
  { label: 'Gherkin', value: 'gherkin' },
  { label: 'GLSL', value: 'glsl' },
  { label: 'Go', value: 'go' },
  { label: 'GraphQL', value: 'graphql' },
  { label: 'Groovy', value: 'groovy' },
  { label: 'Haskell', value: 'haskell' },
  { label: 'HCL', value: 'hcl' },
  { label: 'HTML', value: 'html' },
  { label: 'Idris', value: 'idris' },
  { label: 'Java', value: 'java' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'JSON', value: 'json' },
  { label: 'Julia', value: 'julia' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'LaTeX', value: 'latex' },
  { label: 'Less', value: 'less' },
  { label: 'Lisp', value: 'lisp' },
  { label: 'LiveScript', value: 'livescript' },
  { label: 'LLVM IR', value: 'llvm' },
  { label: 'Lua', value: 'lua' },
  { label: 'Makefile', value: 'makefile' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Markup', value: 'markup' },
  { label: 'MATLAB', value: 'matlab' },
  { label: 'Mathematica', value: 'mathematica' },
  { label: 'Mermaid', value: 'mermaid' },
  { label: 'Nix', value: 'nix' },
  { label: 'Notion Formula', value: 'notion' },
  { label: 'Objective-C', value: 'objectivec' },
  { label: 'OCaml', value: 'ocaml' },
  { label: 'Pascal', value: 'pascal' },
  { label: 'Perl', value: 'perl' },
  { label: 'PHP', value: 'php' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'Prolog', value: 'prolog' },
  { label: 'Protocol Buffers', value: 'protobuf' },
  { label: 'PureScript', value: 'purescript' },
  { label: 'Python', value: 'python' },
  { label: 'R', value: 'r' },
  { label: 'Racket', value: 'racket' },
  { label: 'Reason', value: 'reasonml' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Rust', value: 'rust' },
  { label: 'Sass', value: 'scss' },
  { label: 'Scala', value: 'scala' },
  { label: 'Scheme', value: 'scheme' },
  { label: 'SCSS', value: 'scss' },
  { label: 'Shell', value: 'shell' },
  { label: 'Smalltalk', value: 'smalltalk' },
  { label: 'Solidity', value: 'solidity' },
  { label: 'SQL', value: 'sql' },
  { label: 'Swift', value: 'swift' },
  { label: 'TOML', value: 'toml' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'VB.Net', value: 'vbnet' },
  { label: 'Verilog', value: 'verilog' },
  { label: 'VHDL', value: 'vhdl' },
  { label: 'Visual Basic', value: 'vbnet' },
  { label: 'WebAssembly', value: 'wasm' },
  { label: 'XML', value: 'xml' },
  { label: 'YAML', value: 'yaml' },
];
