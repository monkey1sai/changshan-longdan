// E07 feedback effects (ports of the Web's ShaderMaterials in src/fx/): one shader, the shape chosen by _Mode.
//   0 sparks (sparks.ts: streak quad, uv in [-0.5, 0.5]), 1 dust (dust.ts: soft disc), 2 ground ring (shockwave.ts),
//   3 light pillar (shockwave.ts), 4 spear trail (trail.ts), 5 voxel fragments (lit by the main light, opaque).
// Vertex colours carry the colour (HDR, linear) in rgb and the Web's per-particle alpha or uniform alpha in a. Modes
// 2-4 premultiply like the Web shaders (vec4(color * a, a)) and are drawn with SrcAlpha/One like three.js's
// AdditiveBlending; dust uses SrcAlpha/OneMinusSrcAlpha like NormalBlending. No keywords, so the build keeps it whole.
Shader "Changshan/Feedback"
{
  Properties
  {
    _Mode ("Mode", Float) = 0
    _SrcBlend ("Source blend", Float) = 5
    _DstBlend ("Destination blend", Float) = 1
    _ZWrite ("Depth write", Float) = 0
  }
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" "RenderType" = "Transparent" "Queue" = "Transparent" }
    Pass
    {
      Name "Feedback"
      Tags { "LightMode" = "UniversalForward" }
      Blend [_SrcBlend] [_DstBlend]
      ZWrite [_ZWrite]
      Cull Off

      HLSLPROGRAM
      #pragma vertex Vert
      #pragma fragment Frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

      CBUFFER_START(UnityPerMaterial)
        float _Mode;
        float _SrcBlend;
        float _DstBlend;
        float _ZWrite;
      CBUFFER_END

      struct Attributes
      {
        float4 positionOS : POSITION;
        float3 normalOS : NORMAL;
        float4 color : COLOR;
        float2 uv : TEXCOORD0;
      };

      struct Varyings
      {
        float4 positionCS : SV_POSITION;
        float4 color : COLOR;
        float2 uv : TEXCOORD0;
        float3 normalWS : TEXCOORD1;
      };

      Varyings Vert(Attributes v)
      {
        Varyings o;
        o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
        o.color = v.color;
        o.uv = v.uv;
        o.normalWS = TransformObjectToWorldNormal(v.normalOS);
        return o;
      }

      float4 Frag(Varyings i) : SV_Target
      {
        float4 c = i.color;
        if (_Mode < 0.5)
        {
          float d = abs(i.uv.y) * 2.0;
          float a = (1.0 - d * d) * (1.0 - smoothstep(0.3, 0.5, abs(i.uv.x)));
          return float4(c.rgb, c.a * a);
        }
        if (_Mode < 1.5)
        {
          float d = length(i.uv - 0.5) * 2.0;
          return float4(c.rgb, (1.0 - smoothstep(0.2, 1.0, d)) * c.a);
        }
        if (_Mode < 2.5)
        {
          float r = length(i.uv - 0.5) * 2.0;
          float ring = smoothstep(0.78, 0.94, r) * (1.0 - smoothstep(0.96, 1.0, r));
          float fill = (1.0 - smoothstep(0.0, 1.0, r)) * 0.12;
          float a = (ring + fill) * c.a;
          return float4(c.rgb * a, a);
        }
        if (_Mode < 3.5)
        {
          float a = c.a * (1.0 - i.uv.y) * (0.6 + 0.4 * sin(i.uv.x * 62.83));
          return float4(c.rgb * a, a);
        }
        if (_Mode < 4.5) return float4(c.rgb * c.a, c.a);
        Light light = GetMainLight();
        float ndl = saturate(dot(normalize(i.normalWS), light.direction));
        return float4(c.rgb * (0.35 + 0.65 * ndl * light.color), 1.0);
      }
      ENDHLSL
    }
  }
}
