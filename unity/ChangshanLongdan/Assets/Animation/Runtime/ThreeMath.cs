using System;

namespace Changshan.Animation
{
  // The parts of three.js 0.186 math used by the Web player rig (src/view/player-model.ts, zhaoyun-adapter.ts), ported
  // operation for operation so the C# rig reproduces the Web rig frame by frame. Right-handed, y up, like the Web.
  public struct Vec3
  {
    public double X, Y, Z;

    public Vec3(double x, double y, double z) { X = x; Y = y; Z = z; }

    public static Vec3 operator +(Vec3 a, Vec3 b) => new Vec3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
    public static Vec3 operator -(Vec3 a, Vec3 b) => new Vec3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
    public Vec3 Scale(double s) => new Vec3(X * s, Y * s, Z * s);
    public Vec3 AddScaled(Vec3 v, double s) => new Vec3(X + v.X * s, Y + v.Y * s, Z + v.Z * s);
    public double Dot(Vec3 v) => X * v.X + Y * v.Y + Z * v.Z;
    public double Length() => Math.Sqrt(X * X + Y * Y + Z * Z);
    public double LengthSq() => X * X + Y * Y + Z * Z;

    // Vector3.normalize: divideScalar(length() || 1), i.e. multiply by the reciprocal.
    public Vec3 Normalized()
    {
      double l = Length();
      return Scale(1 / (l == 0 || double.IsNaN(l) ? 1 : l));
    }

    public double DistanceTo(Vec3 v)
    {
      double dx = X - v.X, dy = Y - v.Y, dz = Z - v.Z;
      return Math.Sqrt(dx * dx + dy * dy + dz * dz);
    }

    public double DistanceToSq(Vec3 v)
    {
      double dx = X - v.X, dy = Y - v.Y, dz = Z - v.Z;
      return dx * dx + dy * dy + dz * dz;
    }

    public static Vec3 Cross(Vec3 a, Vec3 b) => new Vec3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X);

    public static Vec3 Lerp(Vec3 a, Vec3 b, double t) => new Vec3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t);

    public Vec3 ApplyQuaternion(Quat q)
    {
      double tx = 2 * (q.Y * Z - q.Z * Y);
      double ty = 2 * (q.Z * X - q.X * Z);
      double tz = 2 * (q.X * Y - q.Y * X);
      return new Vec3(X + q.W * tx + q.Y * tz - q.Z * ty, Y + q.W * ty + q.Z * tx - q.X * tz, Z + q.W * tz + q.X * ty - q.Y * tx);
    }

    public Vec3 ApplyMatrix(in Mat4 m)
    {
      double w = 1 / (m.E3 * X + m.E7 * Y + m.E11 * Z + m.E15);
      return new Vec3((m.E0 * X + m.E4 * Y + m.E8 * Z + m.E12) * w, (m.E1 * X + m.E5 * Y + m.E9 * Z + m.E13) * w,
        (m.E2 * X + m.E6 * Y + m.E10 * Z + m.E14) * w);
    }

    public override string ToString() => $"({X}, {Y}, {Z})";
  }

  public struct Quat
  {
    public double X, Y, Z, W;

    public static readonly Quat Identity = new Quat(0, 0, 0, 1);

    public Quat(double x, double y, double z, double w) { X = x; Y = y; Z = z; W = w; }

    public double Length() => Math.Sqrt(X * X + Y * Y + Z * Z + W * W);
    public double Dot(Quat q) => X * q.X + Y * q.Y + Z * q.Z + W * q.W;

    public Quat Normalized()
    {
      double l = Length();
      if (l == 0) return Identity;
      l = 1 / l;
      return new Quat(X * l, Y * l, Z * l, W * l);
    }

    public Quat Inverse() => new Quat(-X, -Y, -Z, W);

    // multiplyQuaternions(a, b); a.multiply(b) = a * b, a.premultiply(b) = b * a.
    public static Quat operator *(Quat a, Quat b) => new Quat(
      a.X * b.W + a.W * b.X + a.Y * b.Z - a.Z * b.Y,
      a.Y * b.W + a.W * b.Y + a.Z * b.X - a.X * b.Z,
      a.Z * b.W + a.W * b.Z + a.X * b.Y - a.Y * b.X,
      a.W * b.W - a.X * b.X - a.Y * b.Y - a.Z * b.Z);

    // Euler orders used by the Web rig: 'XYZ' (three's default) and 'YXZ' (spear).
    public static Quat FromEuler(double x, double y, double z, bool yxz = false)
    {
      double c1 = Math.Cos(x / 2), c2 = Math.Cos(y / 2), c3 = Math.Cos(z / 2);
      double s1 = Math.Sin(x / 2), s2 = Math.Sin(y / 2), s3 = Math.Sin(z / 2);
      return yxz
        ? new Quat(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3)
        : new Quat(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3);
    }

    public static Quat FromUnitVectors(Vec3 from, Vec3 to)
    {
      double r = from.Dot(to) + 1;
      Quat q;
      if (r < 1e-8)
      {
        q = Math.Abs(from.X) > Math.Abs(from.Z) ? new Quat(-from.Y, from.X, 0, 0) : new Quat(0, -from.Z, from.Y, 0);
      }
      else
      {
        q = new Quat(from.Y * to.Z - from.Z * to.Y, from.Z * to.X - from.X * to.Z, from.X * to.Y - from.Y * to.X, r);
      }
      return q.Normalized();
    }

    // Assumes the upper 3x3 of m is a pure rotation.
    public static Quat FromRotationMatrix(in Mat4 m)
    {
      double m11 = m.E0, m12 = m.E4, m13 = m.E8, m21 = m.E1, m22 = m.E5, m23 = m.E9, m31 = m.E2, m32 = m.E6, m33 = m.E10;
      double trace = m11 + m22 + m33;
      if (trace > 0)
      {
        double s = 0.5 / Math.Sqrt(trace + 1.0);
        return new Quat((m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s);
      }
      if (m11 > m22 && m11 > m33)
      {
        double s = 2.0 * Math.Sqrt(1.0 + m11 - m22 - m33);
        return new Quat(0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s);
      }
      if (m22 > m33)
      {
        double s = 2.0 * Math.Sqrt(1.0 + m22 - m11 - m33);
        return new Quat((m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s);
      }
      {
        double s = 2.0 * Math.Sqrt(1.0 + m33 - m11 - m22);
        return new Quat((m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s);
      }
    }

    // this.slerp(qb, t)
    public Quat Slerp(Quat qb, double t)
    {
      double x = qb.X, y = qb.Y, z = qb.Z, w = qb.W;
      double dot = Dot(qb);
      if (dot < 0)
      {
        x = -x; y = -y; z = -z; w = -w;
        dot = -dot;
      }
      double s = 1 - t;
      if (dot < 0.9995)
      {
        double theta = Math.Acos(dot);
        double sin = Math.Sin(theta);
        s = Math.Sin(s * theta) / sin;
        t = Math.Sin(t * theta) / sin;
        return new Quat(X * s + x * t, Y * s + y * t, Z * s + z * t, W * s + w * t);
      }
      return new Quat(X * s + x * t, Y * s + y * t, Z * s + z * t, W * s + w * t).Normalized();
    }

    public override string ToString() => $"({X}, {Y}, {Z}, {W})";
  }

  // Column-major like three's Matrix4.elements (E12..E14 is the translation).
  public struct Mat4
  {
    public double E0, E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11, E12, E13, E14, E15;

    public static readonly Mat4 Identity = new Mat4 { E0 = 1, E5 = 1, E10 = 1, E15 = 1 };

    public Vec3 Position => new Vec3(E12, E13, E14);

    public static Mat4 Compose(Vec3 p, Quat q, Vec3 s)
    {
      double x = q.X, y = q.Y, z = q.Z, w = q.W;
      double x2 = x + x, y2 = y + y, z2 = z + z;
      double xx = x * x2, xy = x * y2, xz = x * z2;
      double yy = y * y2, yz = y * z2, zz = z * z2;
      double wx = w * x2, wy = w * y2, wz = w * z2;
      return new Mat4
      {
        E0 = (1 - (yy + zz)) * s.X, E1 = (xy + wz) * s.X, E2 = (xz - wy) * s.X, E3 = 0,
        E4 = (xy - wz) * s.Y, E5 = (1 - (xx + zz)) * s.Y, E6 = (yz + wx) * s.Y, E7 = 0,
        E8 = (xz + wy) * s.Z, E9 = (yz - wx) * s.Z, E10 = (1 - (xx + yy)) * s.Z, E11 = 0,
        E12 = p.X, E13 = p.Y, E14 = p.Z, E15 = 1,
      };
    }

    public static Mat4 MakeBasis(Vec3 x, Vec3 y, Vec3 z) => new Mat4
    {
      E0 = x.X, E1 = x.Y, E2 = x.Z, E4 = y.X, E5 = y.Y, E6 = y.Z, E8 = z.X, E9 = z.Y, E10 = z.Z, E15 = 1,
    };

    // multiplyMatrices(a, b)
    public static Mat4 operator *(in Mat4 a, in Mat4 b) => new Mat4
    {
      E0 = a.E0 * b.E0 + a.E4 * b.E1 + a.E8 * b.E2 + a.E12 * b.E3,
      E4 = a.E0 * b.E4 + a.E4 * b.E5 + a.E8 * b.E6 + a.E12 * b.E7,
      E8 = a.E0 * b.E8 + a.E4 * b.E9 + a.E8 * b.E10 + a.E12 * b.E11,
      E12 = a.E0 * b.E12 + a.E4 * b.E13 + a.E8 * b.E14 + a.E12 * b.E15,
      E1 = a.E1 * b.E0 + a.E5 * b.E1 + a.E9 * b.E2 + a.E13 * b.E3,
      E5 = a.E1 * b.E4 + a.E5 * b.E5 + a.E9 * b.E6 + a.E13 * b.E7,
      E9 = a.E1 * b.E8 + a.E5 * b.E9 + a.E9 * b.E10 + a.E13 * b.E11,
      E13 = a.E1 * b.E12 + a.E5 * b.E13 + a.E9 * b.E14 + a.E13 * b.E15,
      E2 = a.E2 * b.E0 + a.E6 * b.E1 + a.E10 * b.E2 + a.E14 * b.E3,
      E6 = a.E2 * b.E4 + a.E6 * b.E5 + a.E10 * b.E6 + a.E14 * b.E7,
      E10 = a.E2 * b.E8 + a.E6 * b.E9 + a.E10 * b.E10 + a.E14 * b.E11,
      E14 = a.E2 * b.E12 + a.E6 * b.E13 + a.E10 * b.E14 + a.E14 * b.E15,
      E3 = a.E3 * b.E0 + a.E7 * b.E1 + a.E11 * b.E2 + a.E15 * b.E3,
      E7 = a.E3 * b.E4 + a.E7 * b.E5 + a.E11 * b.E6 + a.E15 * b.E7,
      E11 = a.E3 * b.E8 + a.E7 * b.E9 + a.E11 * b.E10 + a.E15 * b.E11,
      E15 = a.E3 * b.E12 + a.E7 * b.E13 + a.E11 * b.E14 + a.E15 * b.E15,
    };

    public Mat4 Inverse()
    {
      double n11 = E0, n21 = E1, n31 = E2, n41 = E3, n12 = E4, n22 = E5, n32 = E6, n42 = E7;
      double n13 = E8, n23 = E9, n33 = E10, n43 = E11, n14 = E12, n24 = E13, n34 = E14, n44 = E15;
      double t1 = n11 * n22 - n21 * n12, t2 = n11 * n32 - n31 * n12, t3 = n11 * n42 - n41 * n12;
      double t4 = n21 * n32 - n31 * n22, t5 = n21 * n42 - n41 * n22, t6 = n31 * n42 - n41 * n32;
      double t7 = n13 * n24 - n23 * n14, t8 = n13 * n34 - n33 * n14, t9 = n13 * n44 - n43 * n14;
      double t10 = n23 * n34 - n33 * n24, t11 = n23 * n44 - n43 * n24, t12 = n33 * n44 - n43 * n34;
      double det = t1 * t12 - t2 * t11 + t3 * t10 + t4 * t9 - t5 * t8 + t6 * t7;
      if (det == 0) return default;
      double d = 1 / det;
      return new Mat4
      {
        E0 = (n22 * t12 - n32 * t11 + n42 * t10) * d, E1 = (n31 * t11 - n21 * t12 - n41 * t10) * d,
        E2 = (n24 * t6 - n34 * t5 + n44 * t4) * d, E3 = (n33 * t5 - n23 * t6 - n43 * t4) * d,
        E4 = (n32 * t9 - n12 * t12 - n42 * t8) * d, E5 = (n11 * t12 - n31 * t9 + n41 * t8) * d,
        E6 = (n34 * t3 - n14 * t6 - n44 * t2) * d, E7 = (n13 * t6 - n33 * t3 + n43 * t2) * d,
        E8 = (n12 * t11 - n22 * t9 + n42 * t7) * d, E9 = (n21 * t9 - n11 * t11 - n41 * t7) * d,
        E10 = (n14 * t5 - n24 * t3 + n44 * t1) * d, E11 = (n23 * t3 - n13 * t5 - n43 * t1) * d,
        E12 = (n22 * t8 - n12 * t10 - n32 * t7) * d, E13 = (n11 * t10 - n21 * t8 + n31 * t7) * d,
        E14 = (n24 * t2 - n14 * t4 - n34 * t1) * d, E15 = (n13 * t4 - n23 * t2 + n33 * t1) * d,
      };
    }

    public double DeterminantAffine() =>
      E0 * (E5 * E10 - E9 * E6) - E4 * (E1 * E10 - E9 * E2) + E8 * (E1 * E6 - E5 * E2);

    public void Decompose(out Vec3 position, out Quat rotation, out Vec3 scale)
    {
      position = new Vec3(E12, E13, E14);
      double det = DeterminantAffine();
      if (det == 0)
      {
        scale = new Vec3(1, 1, 1);
        rotation = Quat.Identity;
        return;
      }
      double sx = new Vec3(E0, E1, E2).Length();
      double sy = new Vec3(E4, E5, E6).Length();
      double sz = new Vec3(E8, E9, E10).Length();
      if (det < 0) sx = -sx;
      var m = this;
      double ix = 1 / sx, iy = 1 / sy, iz = 1 / sz;
      m.E0 *= ix; m.E1 *= ix; m.E2 *= ix;
      m.E4 *= iy; m.E5 *= iy; m.E6 *= iy;
      m.E8 *= iz; m.E9 *= iz; m.E10 *= iz;
      rotation = Quat.FromRotationMatrix(m);
      scale = new Vec3(sx, sy, sz);
    }
  }
}
