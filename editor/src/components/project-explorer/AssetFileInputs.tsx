import type { ChangeEvent, RefObject } from 'react'

type FileInputHandler = (e: ChangeEvent<HTMLInputElement>) => void

export type AssetFileInputsProps = Readonly<{
  imageRef: RefObject<HTMLInputElement | null>
  audioRef: RefObject<HTMLInputElement | null>
  fontRef: RefObject<HTMLInputElement | null>
  tilesetRef: RefObject<HTMLInputElement | null>
  onPickImage: FileInputHandler
  onPickAudio: FileInputHandler
  onPickFont: FileInputHandler
  onPickTileset: FileInputHandler
}>

/** The hidden <input type="file"> elements the asset toolbar/menus click. */
export function AssetFileInputs({
  imageRef,
  audioRef,
  fontRef,
  tilesetRef,
  onPickImage,
  onPickAudio,
  onPickFont,
  onPickTileset,
}: AssetFileInputsProps) {
  return (
    <>
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickImage}
      />
      <input
        ref={audioRef}
        type="file"
        accept="audio/ogg,audio/wav,audio/mpeg,.ogg,.wav,.mp3"
        className="hidden"
        onChange={onPickAudio}
      />
      <input
        ref={fontRef}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        onChange={onPickFont}
      />
      <input
        ref={tilesetRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickTileset}
      />
    </>
  )
}
